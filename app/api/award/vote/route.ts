import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendVoteConfirmationEmail } from '@/lib/email';
import { getTaipeiDayBounds } from '@/lib/taipeiTime';
import crypto from 'crypto';
import { verifyRecaptcha } from '@/lib/recaptcha';

const voteSecret = process.env.VOTE_SECRET;

// Voting deadline: 2026-04-30 12:00 (Taiwan time)
const VOTING_DEADLINE = new Date('2026-04-30T12:00:00+08:00');

/**
 * Generate a vote confirmation token
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
 * Verify and parse a vote token
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
    
    // Verify hash
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
 * Check if user has already voted today
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
 * Check if user follows the Instagram account
 * Note: this requires the Instagram API to verify; this provides a basic scaffold
 */
async function checkIfFollowing(email: string, username: string): Promise<boolean> {
  // TODO: Integrate Instagram API to check if user follows the account
  // Returning true for now; should call the Instagram API
  // or verify via other means (e.g. require Instagram username)
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // Check if voting has ended
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Verify reCAPTCHA
    const rc = await verifyRecaptcha(recaptchaToken, 'vote');
    if (!rc.ok) {
      if (rc.reason === 'not_configured') {
        return NextResponse.json(
          { error: 'reCAPTCHA is not configured on the server.' },
          { status: 500 }
        );
      }
      if (rc.reason === 'missing_token') {
        return NextResponse.json(
          { error: 'reCAPTCHA verification is required' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed' },
        { status: 400 }
      );
    }

    // Check if already voted today
    const alreadyVoted = await hasVotedToday(emailLower);
    if (alreadyVoted) {
      return NextResponse.json(
        { error: 'You have already voted today. Come back tomorrow!' },
        { status: 409 }
      );
    }

    // Check if post_id exists in the ig_posts table
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

    // Check subscription status (newsletter_subscriptions table)
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
      // User not subscribed; return follow-required error
      return NextResponse.json(
        { 
          error: 'Please follow us first to vote. Subscribe to our newsletter to continue.',
          requiresFollow: true 
        },
        { status: 400 }
      );
    }

    // Check for existing unconfirmed vote
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
      // Reuse existing unconfirmed vote
      voteId = existingVote[0].id;
    } else {
      // Create a new vote record (omit created_at so the DB uses its default)
      const voteData = {
        post_id: postId,
        email: emailLower,
        confirmed: false,
        // created_at is set automatically by the DB (DEFAULT NOW())
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

    // Generate confirmation token
    const confirmToken = generateVoteToken(postId, emailLower);

    // Send confirmation email
    try {
      await sendVoteConfirmationEmail(emailLower, postId, confirmToken);
    } catch (emailError) {
      console.error('[Award Vote API] Failed to send confirmation email:', emailError);
      // Email failure should not block vote creation
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
