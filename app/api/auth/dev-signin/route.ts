// Dev-only auth bypass for local E2E tests.
// Triple-gated: NODE_ENV !== 'production', DEV_SIGNIN_SECRET env var set,
// matching x-dev-signin-secret header, and email in allowlist.
// Any one failure → 404, never leak the route's existence.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { signSessionToken } from '@/lib/auth';

const SESSION_COOKIE = 'tdf_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const ALLOWED_EMAILS = new Set([
  'kk@dna.org.tw',
  'test@localhost',
]);

function notFound() {
  return new NextResponse('Not Found', { status: 404 });
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') return notFound();

  const expectedSecret = process.env.DEV_SIGNIN_SECRET;
  if (!expectedSecret) return notFound();

  const providedSecret = req.headers.get('x-dev-signin-secret');
  if (providedSecret !== expectedSecret) return notFound();

  if (!supabaseServer) return notFound();

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!ALLOWED_EMAILS.has(email)) return notFound();

  const { data: user, error } = await supabaseServer
    .from('users')
    .select('id, email')
    .eq('email', email)
    .single();

  if (error || !user) return notFound();

  const jwt = await signSessionToken(user.email, user.id);
  const response = NextResponse.json({ success: true, email: user.email });
  response.cookies.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
