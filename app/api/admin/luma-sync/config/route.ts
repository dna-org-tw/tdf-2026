import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { getPublicConfig, updateConfig } from '@/lib/lumaSyncConfig';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await getPublicConfig());
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { cookie, cronEnabled, cronSchedule } = body as {
    cookie?: string; cronEnabled?: boolean; cronSchedule?: string;
  };
  // The actual cron is owned by Supabase pg_cron (see
  // supabase/migrations/add_pg_cron_luma_sync.sql). Writing to
  // luma_sync_config.cron_schedule does NOT change the firing time.
  if (cronSchedule !== undefined) {
    return NextResponse.json(
      {
        error: 'cron_schedule_is_read_only',
        message:
          'Schedule is controlled by Supabase pg_cron job `luma-sync-every-30min`. Update the schedule via cron.schedule() on the database.',
      },
      { status: 400 },
    );
  }
  try {
    await updateConfig({ cookie, cronEnabled, updatedBy: session.email });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
