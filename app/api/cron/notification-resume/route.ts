import { NextRequest, NextResponse } from 'next/server';
import { resumeStalledNotifications } from '@/lib/notificationReconciler';

export const dynamic = 'force-dynamic';

/**
 * Periodic safety-net for fire-and-forget notification sends. Instrumentation
 * only resumes on process boot; this catches any notification that got stuck
 * between deploys (crashes, OOM, transient DB errors during a drainer run).
 *
 * Auth mirrors /api/cron/luma-sync: pg_cron job invokes with
 * Authorization: Bearer <CRON_SECRET>.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: 'cron_disabled' }, { status: 503 });
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resumed = await resumeStalledNotifications();
    return NextResponse.json({ resumed });
  } catch (err) {
    return NextResponse.json(
      { error: 'resume_failed', message: (err as Error).message },
      { status: 500 },
    );
  }
}
