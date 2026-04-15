import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { signSessionToken, setSessionCookie } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { createHash } from 'crypto';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const memberUrl = `${baseUrl}/member`;

  try {
    // Rate limit by IP: 10 attempts per 15 minutes
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limit = await checkRateLimit(`verify:ip:${ip}`, { limit: 10, windowSeconds: 15 * 60 });
    if (!limit.allowed) {
      return NextResponse.redirect(`${baseUrl}/auth/callback?error=rate_limited`);
    }

    if (!supabaseServer) {
      return NextResponse.redirect(`${baseUrl}/auth/callback?error=server_error`);
    }

    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.redirect(`${baseUrl}/auth/callback?error=missing_token`);
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Find matching token
    const { data: tokenRow, error: findError } = await supabaseServer
      .from('auth_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('used', false)
      .single();

    if (findError || !tokenRow) {
      // Check if token was already used
      const { data: usedToken } = await supabaseServer
        .from('auth_tokens')
        .select('id')
        .eq('token_hash', tokenHash)
        .eq('used', true)
        .limit(1);

      if (usedToken && usedToken.length > 0) {
        return NextResponse.redirect(`${baseUrl}/auth/callback?error=already_used`);
      }

      return NextResponse.redirect(`${baseUrl}/auth/callback?error=invalid_token`);
    }

    // Check expiration
    if (new Date(tokenRow.expires_at) < new Date()) {
      // Mark as used so it can't be retried
      await supabaseServer
        .from('auth_tokens')
        .update({ used: true })
        .eq('id', tokenRow.id);

      return NextResponse.redirect(`${baseUrl}/auth/callback?error=expired`);
    }

    // Mark token as used
    await supabaseServer
      .from('auth_tokens')
      .update({ used: true })
      .eq('id', tokenRow.id);

    // Get or create user
    const { data: user, error: userError } = await supabaseServer
      .from('users')
      .select('id, email')
      .eq('email', tokenRow.email)
      .single();

    if (userError || !user) {
      console.error('[Auth] User not found for verified token:', tokenRow.email);
      return NextResponse.redirect(`${baseUrl}/auth/callback?error=server_error`);
    }

    // Update last login
    await supabaseServer
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Sign JWT and set cookie
    const jwt = await signSessionToken(user.email, user.id);
    const response = NextResponse.redirect(memberUrl);
    setSessionCookie(response, jwt);

    return response;
  } catch (error) {
    console.error('[Auth] Error in verify:', error);
    return NextResponse.redirect(`${baseUrl}/auth/callback?error=server_error`);
  }
}
