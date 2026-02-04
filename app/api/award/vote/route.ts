import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendVoteConfirmationEmail } from '@/lib/email';
import crypto from 'crypto';

const recaptchaApiKey = process.env.RECAPTCHA_API_KEY;
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6Lcu81gsAAAAAIrVoGK7urIEt9_w7gOoUSjzC5Uv';
const recaptchaProjectId = process.env.RECAPTCHA_PROJECT_ID || 'tdna-1769599168858';
const voteSecret = process.env.VOTE_SECRET || 'default-vote-secret-change-in-production';

// 投票截止时间：2026年4月30日 12:00 (台湾时间)
const VOTING_DEADLINE = new Date('2026-04-30T12:00:00+08:00');

/**
 * 生成投票确认 token
 */
function generateVoteToken(postId: string, email: string): string {
  const hash = crypto
    .createHmac('sha256', voteSecret)
    .update(`${postId}:${email}:${Date.now()}`)
    .digest('hex');
  
  const token = Buffer.from(`${postId}:${email}:${Date.now()}:${hash}`).toString('base64url');
  return token;
}

/**
 * 验证并解析投票 token
 */
function verifyVoteToken(token: string): { postId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    
    if (parts.length !== 4) {
      return null;
    }
    
    const [postId, email, timestamp, hash] = parts;
    
    // 验证 hash
    const expectedHash = crypto
      .createHmac('sha256', voteSecret)
      .update(`${postId}:${email}:${timestamp}`)
      .digest('hex');
    
    if (hash !== expectedHash) {
      return null;
    }
    
    // 检查 token 是否过期（24小时）
    const tokenTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (now - tokenTime > 24 * 60 * 60 * 1000) {
      return null;
    }
    
    return { postId, email };
  } catch (error) {
    return null;
  }
}

/**
 * 检查用户今天是否已经投票
 */
async function hasVotedToday(email: string): Promise<boolean> {
  if (!supabaseServer) {
    return false;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabaseServer
      .from('award_votes')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('confirmed', true)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
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
 * 检查用户是否已关注 Instagram 账号
 * 注意：这需要 Instagram API 来验证，这里提供一个基础结构
 */
async function checkIfFollowing(email: string, username: string): Promise<boolean> {
  // TODO: 集成 Instagram API 来检查用户是否已关注
  // 这里暂时返回 true，实际应该调用 Instagram API
  // 或者通过其他方式验证（如要求用户提供 Instagram 用户名）
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // 检查投票是否已截止
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

    // 验证 Email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // 验证 reCAPTCHA
    if (recaptchaApiKey) {
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

        // 检查风险评分
        if (recaptchaData.riskAnalysis?.score !== undefined) {
          const score = recaptchaData.riskAnalysis.score;
          if (score < 0.5) {
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
    }

    // 检查今天是否已经投票
    const alreadyVoted = await hasVotedToday(emailLower);
    if (alreadyVoted) {
      return NextResponse.json(
        { error: 'You have already voted today. Come back tomorrow!' },
        { status: 409 }
      );
    }

    // 检查 post_id 是否存在于 ig_posts 表
    const { data: postExists, error: postCheckError } = await supabaseServer
      .from('ig_posts')
      .select('id')
      .eq('id', postId)
      .limit(1);

    if (postCheckError) {
      console.error('[Award Vote API] Error checking post existence:', postCheckError);
      return NextResponse.json(
        { error: 'Failed to verify post', details: postCheckError.message },
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

    // 检查是否已关注（检查 newsletter_subscriptions 表）
    const { data: subscription, error: subscriptionError } = await supabaseServer
      .from('newsletter_subscriptions')
      .select('email')
      .eq('email', emailLower)
      .limit(1);

    if (subscriptionError) {
      console.error('[Award Vote API] Error checking subscription:', subscriptionError);
      // 如果查询出错，继续执行投票流程（不阻止投票）
    } else if (!subscription || subscription.length === 0) {
      // 用户未订阅，返回需要关注的错误
      return NextResponse.json(
        { 
          error: 'Please follow us first to vote. Subscribe to our newsletter to continue.',
          requiresFollow: true 
        },
        { status: 400 }
      );
    }

    // 检查是否已有未确认的投票
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
        { error: 'Failed to check existing vote', details: existingVoteError.message },
        { status: 500 }
      );
    }

    let voteId: string;

    if (existingVote && existingVote.length > 0) {
      // 更新现有未确认的投票
      voteId = existingVote[0].id;
    } else {
      // 创建新的投票记录（不设置 created_at，让数据库使用默认值）
      const voteData = {
        post_id: postId,
        email: emailLower,
        confirmed: false,
        // created_at 由数据库自动设置（DEFAULT NOW()）
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
        
        // 提供更友好的错误信息
        let errorMessage = 'Failed to create vote';
        if (insertError.code === '23503') {
          errorMessage = 'Invalid post ID. The post may not exist.';
        } else if (insertError.code === '23505') {
          errorMessage = 'A vote record already exists for this post and email.';
        } else if (insertError.message) {
          errorMessage = insertError.message;
        }
        
        return NextResponse.json(
          { 
            error: errorMessage,
            details: insertError.details || insertError.hint || 'Database insert failed',
            code: insertError.code,
          },
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

    // 生成确认 token
    const confirmToken = generateVoteToken(postId, emailLower);

    // 发送确认邮件
    try {
      await sendVoteConfirmationEmail(emailLower, postId, confirmToken);
    } catch (emailError) {
      console.error('[Award Vote API] Failed to send confirmation email:', emailError);
      // 邮件发送失败不影响投票记录的创建
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
