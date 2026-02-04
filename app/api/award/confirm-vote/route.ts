import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import crypto from 'crypto';

// 投票截止时间：2026年4月30日 12:00 (台湾时间)
const VOTING_DEADLINE = new Date('2026-04-30T12:00:00+08:00');

/**
 * 验证并解析投票 token
 */
function verifyVoteToken(token: string): { postId: string; email: string } | null {
  const voteSecret = process.env.VOTE_SECRET || 'default-vote-secret-change-in-production';
  
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
    
    return { postId, email: email.toLowerCase() };
  } catch (error) {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // 检查投票是否已截止
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

    // 验证 token
    const tokenData = verifyVoteToken(token);
    if (!tokenData) {
      // 重定向到错误页面
      return NextResponse.redirect(
        new URL(`/award/confirm?error=invalid_token`, req.url)
      );
    }

    const { postId, email } = tokenData;

    // 查找未确认的投票
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
      // 检查是否已经确认过
      const { data: confirmedVote } = await supabaseServer
        .from('award_votes')
        .select('id')
        .eq('post_id', postId)
        .eq('email', email)
        .eq('confirmed', true)
        .limit(1);

      if (confirmedVote && confirmedVote.length > 0) {
        // 重定向到已确认页面
        return NextResponse.redirect(
          new URL(`/award/confirm?error=already_confirmed`, req.url)
        );
      }

      // 重定向到未找到页面
      return NextResponse.redirect(
        new URL(`/award/confirm?error=not_found`, req.url)
      );
    }

    // 检查今天是否已经确认过其他投票
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: todayVotes } = await supabaseServer
      .from('award_votes')
      .select('id')
      .eq('email', email)
      .eq('confirmed', true)
      .gte('confirmed_at', today.toISOString())
      .lt('confirmed_at', tomorrow.toISOString())
      .limit(1);

    if (todayVotes && todayVotes.length > 0) {
      // 删除这个未确认的投票（因为今天已经投过票了）
      await supabaseServer
        .from('award_votes')
        .delete()
        .eq('id', vote.id);

      // 重定向到已投票页面
      return NextResponse.redirect(
        new URL(`/award/confirm?error=already_voted_today`, req.url)
      );
    }

    // 确认投票
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

    // 重定向到确认成功页面
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
