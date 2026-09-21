import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';

/**
 * Admin-side button "重新觸發 cron". Server-to-server invokes the same
 * /api/cron/luma-sync endpoint that GitHub Actions hits, so the test path is
 * identical to a real cron tick (CRON_SECRET auth + cron_enabled check).
 *
 * Distinct from /api/admin/luma-sync/start which always queues a job; this
 * endpoint will return `skipped: cron_disabled` if the cron flag is off,
 * which is the correct signal that the GH workflow would also skip.
 */
export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'cron_secret_missing', message: 'CRON_SECRET is not configured' },
      { status: 503 },
    );
  }

  // Build the absolute URL to our own cron endpoint. Prefer NEXT_PUBLIC_SITE_URL
  // (set in production) and fall back to req.url's origin for local dev.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const target = `${baseUrl.replace(/\/$/, '')}/api/cron/luma-sync`;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'fetch_failed', message: (err as Error).message, target },
      { status: 502 },
    );
  }

  const body = await upstream.json().catch(() => ({}));
  return NextResponse.json(
    { upstreamStatus: upstream.status, target, body },
    { status: upstream.ok ? 200 : upstream.status },
  );
}
