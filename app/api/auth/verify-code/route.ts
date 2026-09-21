// app/api/auth/verify-code/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { signSessionToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { createHash } from 'crypto';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const SESSION_COOKIE = 'tdf_session';

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limit = await checkRateLimit(`verify-code:ip:${ip}`, { limit: 10, windowSeconds: 15 * 60 });
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.email || !body?.code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const code = body.code.trim();

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
    }

    // Per-email rate limit to prevent brute force (10 attempts per 15 min)
    const emailLimit = await checkRateLimit(`verify-code:email:${email}`, { limit: 10, windowSeconds: 15 * 60 });
    if (!emailLimit.allowed) {
      return NextResponse.json({ error: 'Too many attempts for this email' }, { status: 429 });
    }

    const tokenHash = createHash('sha256').update(code).digest('hex');

    // Find matching token
    const { data: tokenRow, error: findError } = await supabaseServer
      .from('auth_tokens')
      .select('*')
      .eq('email', email)
      .eq('token_hash', tokenHash)
      .eq('used', false)
      .single();

    if (findError || !tokenRow) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    // Check expiration
    if (new Date(tokenRow.expires_at) < new Date()) {
      await supabaseServer
        .from('auth_tokens')
        .update({ used: true })
        .eq('id', tokenRow.id);
      return NextResponse.json({ error: 'Code has expired' }, { status: 401 });
    }

    // Mark token as used
    await supabaseServer
      .from('auth_tokens')
      .update({ used: true })
      .eq('id', tokenRow.id);

    // Get user
    const { data: user, error: userError } = await supabaseServer
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.error('[Auth] User not found for verified code:', email);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }

    // Update last login
    await supabaseServer
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Sign JWT and set cookie
    const jwt = await signSessionToken(user.email, user.id);
    const response = NextResponse.json({ success: true });

    response.cookies.set(SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error('[Auth] Error in verify-code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
