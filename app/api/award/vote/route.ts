import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendVoteConfirmationEmail } from '@/lib/email';
import { getTaipeiDayBounds } from '@/lib/taipeiTime';
import { getMinRecaptchaScore } from '@/lib/recaptchaScore';
import crypto from 'crypto';

const recaptchaApiKey = process.env.RECAPTCHA_API_KEY;
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
const recaptchaProjectId = process.env.RECAPTCHA_PROJECT_ID;
const voteSecret = process.env.VOTE_SECRET;

// 投票截止時間：2026年4月30日 12:00（台灣時間）
const VOTING_DEADLINE = new Date('2026-04-30T12:00:00+08:00');

/**
 * 產生投票確認 token
 */
function generateVoteToken(postId: string, email: string): string {
  if (!voteSecret) {
    throw new Error('VOTE_SECRET is not configured');
  }
  const hash = crypto
    .createHmac('sha256', voteSecret)
    .update(`${postId}:${email}:${Date.now()}`)
    .digest('hex');
  
  const token = Buffer.from(`${postId}:${email}:${Date.now()}:${hash}`).toString('base64url');
  return token;
}

/**
 * 驗證並解析投票 token
 */
function verifyVoteToken(token: string): { postId: string; email: string } | null {
  if (!voteSecret) {
    return null;
  }
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    
    if (parts.length !== 4) {
      return null;
    }
    
    const [postId, email, timestamp, hash] = parts;
    
    // 驗證 hash
    const expectedHash = crypto
      .createHmac('sha256', voteSecret)
      .update(`${postId}:${email}:${timestamp}`)
      .digest('hex');
    
    if (hash !== expectedHash) {
      return null;
    }
    
    // Token valid for 7 days — gives users a realistic window to confirm
    // without forcing them back inside 24h.
    const tokenTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (now - tokenTime > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }
    
    return { postId, email };
  } catch (error) {
    return null;
  }
}

/**
 * 檢查使用者今天是否已經投票
 */
async function hasVotedToday(email: string): Promise<boolean> {
  if (!supabaseServer) {
    return false;
  }

  try {
    // Use Taipei time (UTC+8) for "today" boundary since this is a Taiwan event
    const { todayStart, tomorrowStart } = getTaipeiDayBounds();

    const { data, error } = await supabaseServer
      .from('award_votes')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('confirmed', true)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString())
      .limit(1);

    if (error) {
      console.error('[Award Vote API] Error checking vote:', error);
      return false;
    }

    return (data?.length || 0) > 0;
  } catch (error) {
    console.error('[Award Vote API] Error checking vote:', error);
    return false;
  }
}

/**
 * 檢查使用者是否已關注 Instagram 帳號
 * 注意：這需要 Instagram API 來驗證，這裡提供一個基礎結構
 */
async function checkIfFollowing(email: string, username: string): Promise<boolean> {
  // TODO: 整合 Instagram API 來檢查使用者是否已關注
  // 這裡暫時回傳 true，實際應該呼叫 Instagram API
  // 或透過其他方式驗證（如要求使用者提供 Instagram 使用者名）
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // 檢查投票是否已截止
    if (new Date() > VOTING_DEADLINE) {
      return NextResponse.json(
        { error: 'Voting has ended' },
        { status: 400 }
      );
    }

    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || !body.postId || !body.email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { postId, email, recaptchaToken } = body;
    const emailLower = email.trim().toLowerCase();

    // 驗證 Email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // 驗證 reCAPTCHA
    if (!recaptchaApiKey) {
      return NextResponse.json(
        { error: 'reCAPTCHA is not configured on the server.' },
        { status: 500 }
      );
    }

    if (!recaptchaToken) {
      return NextResponse.json(
        { error: 'reCAPTCHA verification is required' },
        { status: 400 }
      );
    }

    try {
      const requestBody = {
        event: {
          token: recaptchaToken,
          expectedAction: 'vote',
          siteKey: recaptchaSiteKey,
        },
      };

      const recaptchaResponse = await fetch(
        `https://recaptchaenterprise.googleapis.com/v1/projects/${recaptchaProjectId}/assessments?key=${recaptchaApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!recaptchaResponse.ok) {
        const errorData = await recaptchaResponse.text();
        console.error('[reCAPTCHA Enterprise] API error:', errorData);
        return NextResponse.json(
          { error: 'reCAPTCHA verification failed' },
          { status: 400 }
        );
      }

      const recaptchaData = await recaptchaResponse.json();

      if (!recaptchaData.tokenProperties?.valid || recaptchaData.tokenProperties?.action !== 'vote') {
        return NextResponse.json(
          { error: 'reCAPTCHA verification failed' },
          { status: 400 }
        );
      }

      // 檢查風險評分（預設門檻 0.7，可經由 RECAPTCHA_MIN_SCORE 調整）
      if (recaptchaData.riskAnalysis?.score !== undefined) {
        const score = recaptchaData.riskAnalysis.score;
        const minScore = getMinRecaptchaScore();
        if (score < minScore) {
          console.warn(`[reCAPTCHA] vote rejected, score ${score} < ${minScore}`);
          return NextResponse.json(
            { error: 'reCAPTCHA verification failed' },
            { status: 400 }
          );
        }
      }
    } catch (error) {
      console.error('[reCAPTCHA Enterprise] Verification error:', error);
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed' },
        { status: 400 }
      );
    }

    // 檢查今天是否已經投票
    const alreadyVoted = await hasVotedToday(emailLower);
    if (alreadyVoted) {
      return NextResponse.json(
        { error: 'You have already voted today. Come back tomorrow!' },
        { status: 409 }
      );
    }

    // 檢查 post_id 是否存在於 ig_posts 表
    const { data: postExists, error: postCheckError } = await supabaseServer
      .from('ig_posts')
      .select('id')
      .eq('id', postId)
      .limit(1);

    if (postCheckError) {
      console.error('[Award Vote API] Error checking post existence:', postCheckError);
      return NextResponse.json(
        { error: 'Failed to verify post' },
        { status: 500 }
      );
    }

    if (!postExists || postExists.length === 0) {
      console.error('[Award Vote API] Post not found in ig_posts:', postId);
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // 檢查是否已關注（檢查 newsletter_subscriptions 表）
    const { data: subscription, error: subscriptionError } = await supabaseServer
      .from('newsletter_subscriptions')
      .select('email')
      .eq('email', emailLower)
      .limit(1);

    if (subscriptionError) {
      console.error('[Award Vote API] Error checking subscription:', subscriptionError);
      return NextResponse.json(
        { error: 'Failed to verify eligibility' },
        { status: 500 }
      );
    }
    if (!subscription || subscription.length === 0) {
      // 使用者未訂閱，回傳需要關注的錯誤
      return NextResponse.json(
        { 
          error: 'Please follow us first to vote. Subscribe to our newsletter to continue.',
          requiresFollow: true 
        },
        { status: 400 }
      );
    }

    // 檢查是否已有未確認的投票
    const { data: existingVote, error: existingVoteError } = await supabaseServer
      .from('award_votes')
      .select('id')
      .eq('post_id', postId)
      .eq('email', emailLower)
      .eq('confirmed', false)
      .limit(1);

    if (existingVoteError) {
      console.error('[Award Vote API] Error checking existing vote:', existingVoteError);
      return NextResponse.json(
        { error: 'Failed to check existing vote' },
        { status: 500 }
      );
    }

    let voteId: string;

    if (existingVote && existingVote.length > 0) {
      // 更新現有未確認的投票
      voteId = existingVote[0].id;
    } else {
      // 建立新的投票記錄（不設定 created_at，讓資料庫使用預設值）
      const voteData = {
        post_id: postId,
        email: emailLower,
        confirmed: false,
        // created_at 由資料庫自動設定（DEFAULT NOW()）
      };
      
      const { data: newVote, error: insertError } = await supabaseServer
        .from('award_votes')
        .insert(voteData)
        .select('id')
        .single();

      if (insertError) {
        console.error('[Award Vote API] Failed to create vote:', {
          error: insertError,
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          voteData,
          postId,
          email: emailLower,
        });

        // Return a generic message to the client; only distinguish
        // known-safe cases that the UI can act on.
        if (insertError.code === '23503') {
          return NextResponse.json(
            { error: 'Invalid post ID. The post may not exist.' },
            { status: 400 }
          );
        }
        if (insertError.code === '23505') {
          return NextResponse.json(
            { error: 'A vote is already pending for this post.' },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: 'Failed to create vote' },
          { status: 500 }
        );
      }

      if (!newVote || !newVote.id) {
        console.error('[Award Vote API] Vote created but no data returned:', newVote);
        return NextResponse.json(
          { error: 'Failed to create vote: No data returned from database' },
          { status: 500 }
        );
      }

      voteId = newVote.id;
    }

    // 產生確認 token
    const confirmToken = generateVoteToken(postId, emailLower);

    // 發送確認郵件
    try {
      await sendVoteConfirmationEmail(emailLower, postId, confirmToken);
    } catch (emailError) {
      console.error('[Award Vote API] Failed to send confirmation email:', emailError);
      // 郵件發送失敗不影響投票記錄的建立
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Vote submitted! Please check your email to confirm.',
        voteId 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Award Vote API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to submit vote' },
      { status: 500 }
    );
  }
}
