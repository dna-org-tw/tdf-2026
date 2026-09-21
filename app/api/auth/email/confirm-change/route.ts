import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { signSessionToken, setSessionCookie, getSessionFromRequest } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { createHash } from 'crypto';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const session = await getSessionFromRequest(req);
    if (!session?.email || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipLimit = await checkRateLimit(`email-change-confirm:ip:${ip}`, { limit: 10, windowSeconds: 15 * 60 });
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.newEmail || !body?.code) {
      return NextResponse.json({ error: 'New email and code are required' }, { status: 400 });
    }

    const newEmail = String(body.newEmail).trim().toLowerCase();
    const code = String(body.code).trim();

    if (!EMAIL_REGEX.test(newEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
    }

    const userIdLimit = await checkRateLimit(`email-change-confirm:user:${session.userId}`, { limit: 10, windowSeconds: 15 * 60 });
    if (!userIdLimit.allowed) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }

    const tokenHash = createHash('sha256').update(code).digest('hex');

    const { data: tokenRow, error: findError } = await supabaseServer
      .from('auth_tokens')
      .select('*')
      .eq('email', newEmail)
      .eq('token_hash', tokenHash)
      .eq('used', false)
      .single();

    if (findError || !tokenRow) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      await supabaseServer.from('auth_tokens').update({ used: true }).eq('id', tokenRow.id);
      return NextResponse.json({ error: 'Code has expired' }, { status: 401 });
    }

    // Re-check the destination is still free (race)
    const [{ data: collidingUser }, { data: collidingMember }] = await Promise.all([
      supabaseServer.from('users').select('id').eq('email', newEmail).maybeSingle(),
      supabaseServer.from('members').select('id').eq('email', newEmail).maybeSingle(),
    ]);
    if (collidingUser || collidingMember) {
      return NextResponse.json({ error: 'email_in_use' }, { status: 409 });
    }

    // Mark token used first so a duplicate confirm can't double-update
    await supabaseServer.from('auth_tokens').update({ used: true }).eq('id', tokenRow.id);

    // Update users.email
    const { error: userUpdateErr } = await supabaseServer
      .from('users')
      .update({ email: newEmail })
      .eq('id', session.userId);
    if (userUpdateErr) {
      console.error('[Email Change Confirm] users update failed', userUpdateErr);
      return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }

    // Update members.email (best-effort: a row may not exist if user has no orders/newsletter yet)
    const currentEmail = session.email.trim().toLowerCase();
    const { error: memberUpdateErr } = await supabaseServer
      .from('members')
      .update({ email: newEmail })
      .eq('email', currentEmail);
    if (memberUpdateErr) {
      console.error('[Email Change Confirm] members update failed', memberUpdateErr);
      // Roll back the users update so the two stay in sync
      await supabaseServer.from('users').update({ email: currentEmail }).eq('id', session.userId);
      return NextResponse.json({ error: 'Failed to update profile email' }, { status: 500 });
    }

    // Issue a fresh session JWT bound to the new email
    const jwt = await signSessionToken(newEmail, session.userId);
    const response = NextResponse.json({ success: true, email: newEmail });
    setSessionCookie(response, jwt);
    return response;
  } catch (e) {
    console.error('[Email Change Confirm] Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
