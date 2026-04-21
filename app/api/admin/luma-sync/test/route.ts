import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { getDecryptedCookie, markCookieInvalid } from '@/lib/lumaSyncConfig';
import { LumaAuthError, probeCookie } from '@/lib/lumaApi';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let cookie: string | null;
  try {
    cookie = await getDecryptedCookie();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `cookie_decrypt_failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
  if (!cookie) {
    return NextResponse.json({ ok: false, error: 'no_cookie' }, { status: 400 });
  }

  try {
    const { entryCount } = await probeCookie(cookie);
    return NextResponse.json({ ok: true, entryCount });
  } catch (err) {
    if (err instanceof LumaAuthError) {
      await markCookieInvalid();
      return NextResponse.json({
        ok: false,
        status: err.statusCode,
        error: 'cookie_invalid',
      });
    }
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
