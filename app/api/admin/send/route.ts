import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { getRecipients, type RecipientGroup } from '@/lib/recipients';
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  MEMBER_STATUSES,
  MEMBER_TIERS,
  TICKET_TIERS,
} from '@/lib/members';
import { enqueueEmails, processAllPending } from '@/lib/notificationEmail';
import { supabaseServer } from '@/lib/supabaseServer';
import { checkRateLimit } from '@/lib/rateLimit';

const VALID_GROUPS: RecipientGroup[] = ['orders', 'subscribers', 'test'];

function toList<T extends string>(val: unknown, allowed: readonly T[]): T[] | undefined {
  if (!Array.isArray(val)) return undefined;
  const list = (val as string[]).filter((v) => (allowed as readonly string[]).includes(v)) as T[];
  return list.length ? list : undefined;
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 1 batch send per minute per admin
  const rateKey = `admin-send:${session.email}`;
  const limit = await checkRateLimit(rateKey, { limit: 1, windowSeconds: 60 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: '請等待一分鐘後再發送' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);

  if (!body?.subject?.trim() || !body?.body?.trim()) {
    return NextResponse.json(
      { error: '主旨和內容為必填' },
      { status: 400 }
    );
  }

  const subject = body.subject.trim();
  const emailBody = body.body.trim();

  const VALID_CATEGORIES = ['newsletter', 'events', 'award', 'critical'] as const;
  type Category = typeof VALID_CATEGORIES[number];
  const category = body.category as Category | undefined;
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: '請選擇信件分類（newsletter / events / award / critical）' },
      { status: 400 }
    );
  }

  const bodyFormat: 'plain' | 'html' = body.bodyFormat === 'html' ? 'html' : 'plain';

  const rawGroups = Array.isArray(body.groups) ? (body.groups as string[]) : undefined;
  const groups = rawGroups
    ? rawGroups.filter((g): g is RecipientGroup => VALID_GROUPS.includes(g as RecipientGroup))
    : undefined;

  const legacyTicketTiers = toList<TicketTier>(body.tiers, TICKET_TIERS);
  const statuses = toList<MemberStatus>(body.statuses, MEMBER_STATUSES);
  const memberTiers = toList<MemberTier>(body.memberTiers, MEMBER_TIERS);
  const ticketTiers = toList<TicketTier>(body.ticketTiers, TICKET_TIERS);

  if ((!groups || groups.length === 0) && !statuses && !memberTiers && !ticketTiers) {
    return NextResponse.json({ error: '請至少選擇一組收件人條件' }, { status: 400 });
  }

  if (category === 'critical' && !statuses && !memberTiers && !ticketTiers) {
    return NextResponse.json(
      { error: '重大通知必須指定身份／狀態／票種等收件人條件，不允許空篩選' },
      { status: 400 },
    );
  }

  try {
    // Fetch recipients
    const { emails, count } = await getRecipients({
      groups,
      statuses,
      memberTiers,
      ticketTiers,
      legacyTicketTiers,
      adminEmail: session.email,
      category,
    });

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
        body_format: bodyFormat,
        category,
        recipient_groups: groups ?? [],
        recipient_tiers: legacyTicketTiers ?? ticketTiers ?? null,
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
