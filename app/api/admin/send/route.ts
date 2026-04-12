import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { getRecipients, type RecipientGroup, type TicketTier } from '@/lib/recipients';
import { enqueueEmails, processAllPending } from '@/lib/notificationEmail';
import { supabaseServer } from '@/lib/supabaseServer';
import { checkRateLimit } from '@/lib/rateLimit';

const VALID_GROUPS: RecipientGroup[] = ['orders', 'subscribers', 'test'];
const VALID_TIERS: TicketTier[] = ['explore', 'contribute', 'weekly_backer', 'backer'];

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 1 batch send per minute per admin
  const rateKey = `admin-send:${session.email}`;
  const limit = checkRateLimit(rateKey, { limit: 1, windowSeconds: 60 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: '請等待一分鐘後再發送' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.subject?.trim() || !body?.body?.trim() || !body?.groups) {
    return NextResponse.json(
      { error: '主旨、內容和收件群組為必填' },
      { status: 400 }
    );
  }

  const subject = body.subject.trim();
  const emailBody = body.body.trim();
  const groups = (body.groups as string[]).filter((g): g is RecipientGroup =>
    VALID_GROUPS.includes(g as RecipientGroup)
  );

  if (groups.length === 0) {
    return NextResponse.json({ error: '請至少選擇一個收件群組' }, { status: 400 });
  }

  const tiers = body.tiers
    ? (body.tiers as string[]).filter((t): t is TicketTier =>
        VALID_TIERS.includes(t as TicketTier)
      )
    : undefined;

  try {
    // Fetch recipients
    const { emails, count } = await getRecipients(groups, tiers, session.email);

    if (count === 0) {
      return NextResponse.json({ error: '沒有符合條件的收件人' }, { status: 400 });
    }

    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Create notification log entry
    const { data: logEntry, error: logError } = await supabaseServer
      .from('notification_logs')
      .insert({
        subject,
        body: emailBody,
        recipient_groups: groups,
        recipient_tiers: tiers || null,
        recipient_count: count,
        sent_by: session.email,
        status: 'sending',
      })
      .select()
      .single();

    if (logError || !logEntry) {
      console.error('[Admin Send] Failed to create log:', logError);
      return NextResponse.json({ error: 'Failed to create send record' }, { status: 500 });
    }

    // Enqueue all emails (inserted as 'pending' in email_logs)
    const { queued } = await enqueueEmails(emails, subject, logEntry.id);

    // Fire-and-forget: start processing in the background
    processAllPending(logEntry.id).catch((err) =>
      console.error('[Admin Send] Background processing error:', err)
    );

    return NextResponse.json({
      success: true,
      notificationId: logEntry.id,
      queued,
    });
  } catch (error) {
    console.error('[Admin Send]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send' },
      { status: 500 }
    );
  }
}
