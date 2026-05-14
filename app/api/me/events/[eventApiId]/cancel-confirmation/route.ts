import { NextRequest, NextResponse } from 'next/server';
import { resolveMemberFromSession } from '@/lib/memberSession';
import { supabaseServer } from '@/lib/supabaseServer';
import { isPastCutoff } from '@/lib/lumaCutoff';

export const dynamic = 'force-dynamic';

// Member cancels a prior confirmation. Allowed only before cutoff — after
// cutoff, the auto-review gate already locks in the decision (a confirmed
// member is committed; an unconfirmed one has been demoted to waitlist).
// Clears the snapshot so a re-confirmation captures the then-current card.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventApiId: string }> },
) {
  const ctx = await resolveMemberFromSession(req);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { eventApiId } = await params;
  if (!eventApiId) return NextResponse.json({ error: 'missing_event_api_id' }, { status: 400 });

  const { data: event, error: eventErr } = await supabaseServer
    .from('luma_events')
    .select('start_at, requires_confirmation')
    .eq('event_api_id', eventApiId)
    .maybeSingle();
  if (eventErr) return NextResponse.json({ error: eventErr.message }, { status: 500 });
  if (!event?.start_at) return NextResponse.json({ error: 'event_not_found' }, { status: 404 });
  if (!event.requires_confirmation) {
    return NextResponse.json({ error: 'event_does_not_require_confirmation' }, { status: 400 });
  }

  if (isPastCutoff(event.start_at, new Date())) {
    return NextResponse.json({ error: 'cutoff_passed' }, { status: 409 });
  }

  const { error: updErr } = await supabaseServer
    .from('event_confirmations')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      payment_method_id_snapshot: null,
      stripe_customer_id_snapshot: null,
    })
    .eq('member_id', ctx.memberId)
    .eq('event_api_id', eventApiId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: 'cancelled' });
}
