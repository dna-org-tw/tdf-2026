import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getTaipeiDayBounds } from '@/lib/taipeiTime';
import crypto from 'crypto';

// Voting deadline: 2026-04-30 12:00 (Taiwan time)
const VOTING_DEADLINE = new Date('2026-04-30T12:00:00+08:00');

/**
 * Verify and parse a vote token
 */
function verifyVoteToken(token: string): { postId: string; email: string } | null {
  const voteSecret = process.env.VOTE_SECRET;
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
    
    // Token valid for 7 days (matches generator in app/api/award/vote/route.ts).
    const tokenTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (now - tokenTime > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }
    
    return { postId, email: email.toLowerCase() };
  } catch (error) {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check if voting has ended
    if (new Date() > VOTING_DEADLINE) {
      return NextResponse.redirect(
        new URL(`/award/confirm?error=voting_ended`, req.url)
      );
    }

    if (!supabaseServer) {
      return NextResponse.redirect(
        new URL(`/award/confirm?error=server_error`, req.url)
      );
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(
        new URL(`/award/confirm?error=missing_token`, req.url)
      );
    }

    // Verify token
    const tokenData = verifyVoteToken(token);
    if (!tokenData) {
      // Redirect to error page
      return NextResponse.redirect(
        new URL(`/award/confirm?error=invalid_token`, req.url)
      );
    }

    const { postId, email } = tokenData;

    // Find unconfirmed vote
    const { data: vote, error: findError } = await supabaseServer
      .from('award_votes')
      .select('*')
      .eq('post_id', postId)
      .eq('email', email)
      .eq('confirmed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (findError || !vote) {
      // Check if already confirmed
      const { data: confirmedVote } = await supabaseServer
        .from('award_votes')
        .select('id')
        .eq('post_id', postId)
        .eq('email', email)
        .eq('confirmed', true)
        .limit(1);

      if (confirmedVote && confirmedVote.length > 0) {
        // Redirect to already-confirmed page
        return NextResponse.redirect(
          new URL(`/award/confirm?error=already_confirmed`, req.url)
        );
      }

      // Redirect to not-found page
      return NextResponse.redirect(
        new URL(`/award/confirm?error=not_found`, req.url)
      );
    }

    // Check if another vote was already confirmed today (Taipei time UTC+8)
    const { todayStart, tomorrowStart } = getTaipeiDayBounds();

    const { data: todayVotes } = await supabaseServer
      .from('award_votes')
      .select('id')
      .eq('email', email)
      .eq('confirmed', true)
      .gte('confirmed_at', todayStart.toISOString())
      .lt('confirmed_at', tomorrowStart.toISOString())
      .limit(1);

    if (todayVotes && todayVotes.length > 0) {
      // Delete this unconfirmed vote (already voted today)
      await supabaseServer
        .from('award_votes')
        .delete()
        .eq('id', vote.id);

      // Redirect to already-voted page
      return NextResponse.redirect(
        new URL(`/award/confirm?error=already_voted_today`, req.url)
      );
    }

    // Confirm the vote
    const { error: updateError } = await supabaseServer
      .from('award_votes')
      .update({
        confirmed: true,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', vote.id);

    if (updateError) {
      console.error('[Award Confirm API] Failed to confirm vote:', updateError);
      return NextResponse.redirect(
        new URL(`/award/confirm?error=failed`, req.url)
      );
    }

    // Redirect to confirmation success page
    return NextResponse.redirect(
      new URL(`/award/confirm?success=true&token=${token}`, req.url)
    );
  } catch (error) {
    console.error('[Award Confirm API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm vote' },
      { status: 500 }
    );
  }
}
