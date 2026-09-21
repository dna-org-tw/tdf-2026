import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { processAllPending } from '@/lib/notificationEmail';

/**
 * Re-kick the queue drainer for a notification whose `pending` rows didn't
 * make it through (server restarted mid-fire-and-forget, OOM, etc.).
 *
 * No locking — admin should only invoke this when the batch is *actually*
 * stalled. The UI hides this button until the notification is older than the
 * stale threshold to reduce double-send risk.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id } = await params;

  const { count: pendingCount, error } = await supabaseServer
    .from('email_logs')
    .select('id', { count: 'exact', head: true })
    .eq('notification_id', id)
    .in('status', ['pending', 'processing']);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!pendingCount || pendingCount === 0) {
    return NextResponse.json({ resumed: 0, message: 'no_pending' });
  }

  // Reset any stuck `processing` rows back to pending so the drainer picks them up.
  await supabaseServer
    .from('email_logs')
    .update({ status: 'pending' })
    .eq('notification_id', id)
    .eq('status', 'processing');

  // Bump notification status back to 'sending' so the UI badge reflects activity.
  await supabaseServer
    .from('notification_logs')
    .update({ status: 'sending', error_message: null })
    .eq('id', id);

  processAllPending(id).catch((err) =>
    console.error('[Resume] background drainer crashed:', err),
  );

  return NextResponse.json({ resumed: pendingCount }, { status: 202 });
}
