import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { resolveMember } from '@/lib/adminMembers';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ memberNo: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

  const { memberNo } = await ctx.params;
  const member = await resolveMember(memberNo);
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const email = member.email;

  try {
    const [
      enrichedRes,
      ordersRes,
      newsletterRes,
      emailLogsRes,
      awardVotesRes,
      transfersRes,
    ] = await Promise.all([
      supabaseServer.from('members_enriched').select('*').eq('email', email).maybeSingle(),
      supabaseServer.from('orders').select('*').ilike('customer_email', email).order('created_at', { ascending: false }),
      supabaseServer.from('newsletter_subscriptions').select('*').ilike('email', email).maybeSingle(),
      supabaseServer.from('email_logs').select('*').ilike('to_email', email).order('created_at', { ascending: false }).limit(200),
      supabaseServer.from('award_votes').select('*').ilike('email', email).order('created_at', { ascending: false }),
      supabaseServer
        .from('order_transfers')
        .select('*')
        .or(`from_email.ilike.${email},to_email.ilike.${email}`)
        .order('transferred_at', { ascending: false }),
    ]);

    const orders = (ordersRes.data ?? []) as Array<{ visitor_id?: string | null }>;
    const emailLogs = (emailLogsRes.data ?? []) as Array<{ notification_id?: string | null }>;
    const newsletter = newsletterRes.data as { visitor_id?: string | null } | null;

    const visitorIds = Array.from(
      new Set(
        [
          ...orders.map((o) => o.visitor_id),
          newsletter?.visitor_id ?? null,
        ].filter((v): v is string => !!v),
      ),
    );

    let visitors: unknown[] = [];
    let trackingEvents: unknown[] = [];
    if (visitorIds.length > 0) {
      // Filter by visitor_id server-side (the JSONB parameters->>'visitor_id' path)
      // before applying the row cap, otherwise this member's older events get
      // pushed out of the window by global traffic.
      const visitorOr = visitorIds
        .map((v) => `parameters->>visitor_id.eq.${v}`)
        .join(',');

      const [vRes, tRes] = await Promise.all([
        supabaseServer.from('visitors').select('*').in('fingerprint', visitorIds),
        supabaseServer
          .from('tracking_events')
          .select('event_name, parameters, occurred_at, created_at')
          .or(visitorOr)
          .order('occurred_at', { ascending: false })
          .limit(50),
      ]);
      visitors = vRes.data ?? [];
      trackingEvents = tRes.data ?? [];
    }

    const notificationIds = Array.from(
      new Set(
        emailLogs.map((l) => l.notification_id).filter((v): v is string => !!v),
      ),
    );
    let notificationCampaigns: unknown[] = [];
    if (notificationIds.length > 0) {
      const { data } = await supabaseServer
        .from('notification_logs')
        .select('id, subject, recipient_count, status, sent_by, created_at')
        .in('id', notificationIds)
        .order('created_at', { ascending: false });
      notificationCampaigns = data ?? [];
    }

    return NextResponse.json({
      member,
      enriched: enrichedRes.data,
      orders,
      newsletter,
      email_logs: emailLogs,
      notification_campaigns: notificationCampaigns,
      award_votes: awardVotesRes.data ?? [],
      visitors,
      tracking_events: trackingEvents,
      order_transfers: transfersRes.data ?? [],
    });
  } catch (err) {
    console.error('[Admin Member Detail]', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
