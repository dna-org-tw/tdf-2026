import { supabaseServer } from '@/lib/supabaseServer';
import { chargeOffSessionTwd } from '@/lib/stripeOffSession';

// Post-event sweep that charges confirmed attendees who didn't check in.
// Designed to be called from runSyncJob() after the regular sync completes.
// All work is idempotent:
//   1. Skip events without a Standard Ticket price (no_show_charges row with
//      status='skipped' so we don't re-evaluate every run).
//   2. Skip (member, event) pairs that already have a no_show_charges row in
//      any state (succeeded/failed/skipped). Manual retries delete the row.
//   3. Pass a deterministic idempotencyKey to Stripe so a duplicate sweep on
//      the same pair never double-charges, even if our DB check races.
//
// Returns counters so the caller can log run stats.

const POST_EVENT_GRACE_HOURS = 4;

export type NoShowChargeStats = {
  candidatesScanned: number;
  charged: number;
  skipped: number;
  failed: number;
};

type CandidateRow = {
  member_id: number;
  event_api_id: string;
  luma_events: {
    name: string;
    end_at: string | null;
    standard_ticket_price_twd: number | null;
  };
  event_confirmations_row: {
    payment_method_id_snapshot: string | null;
    stripe_customer_id_snapshot: string | null;
  };
};

export async function sweepNoShowCharges(): Promise<NoShowChargeStats> {
  const stats: NoShowChargeStats = { candidatesScanned: 0, charged: 0, skipped: 0, failed: 0 };
  if (!supabaseServer) return stats;

  const graceCutoff = new Date(Date.now() - POST_EVENT_GRACE_HOURS * 60 * 60 * 1000).toISOString();

  // Candidate set: approved + not checked-in + event ended > graceCutoff ago,
  // joined to event_confirmations where the member is confirmed. The joins
  // do the filtering — `members!inner` + `event_confirmations!inner` ensure
  // only members with both records pass through.
  //
  // We post-filter for:
  //   - confirmation status = 'confirmed' (the join enforces existence; we
  //     still check status field-by-field below)
  //   - standard_ticket_price_twd > 0 (billable)
  //   - no existing no_show_charges row
  const { data, error } = await supabaseServer
    .from('luma_guests')
    .select(`
      member_id,
      event_api_id,
      luma_events!inner(name, end_at, standard_ticket_price_twd, requires_confirmation),
      event_confirmations!inner(status, payment_method_id_snapshot, stripe_customer_id_snapshot)
    `)
    .is('checked_in_at', null)
    .eq('activity_status', 'approved')
    .not('member_id', 'is', null)
    .lt('luma_events.end_at', graceCutoff)
    .eq('luma_events.requires_confirmation', true)
    .eq('event_confirmations.status', 'confirmed');
  if (error) {
    console.error('[no-show-charger] candidate query failed:', error.message);
    return stats;
  }

  // The Supabase JS client doesn't always preserve nested join field names
  // exactly — pull the confirmation row out by walking the runtime shape.
  type RawRow = {
    member_id: number | null;
    event_api_id: string;
    luma_events:
      | { name: string; end_at: string | null; standard_ticket_price_twd: number | null }
      | Array<{ name: string; end_at: string | null; standard_ticket_price_twd: number | null }>
      | null;
    event_confirmations:
      | { status: string; payment_method_id_snapshot: string | null; stripe_customer_id_snapshot: string | null }
      | Array<{ status: string; payment_method_id_snapshot: string | null; stripe_customer_id_snapshot: string | null }>
      | null;
  };

  const candidates: CandidateRow[] = [];
  for (const raw of (data ?? []) as unknown as RawRow[]) {
    if (!raw.member_id) continue;
    const ev = Array.isArray(raw.luma_events) ? raw.luma_events[0] : raw.luma_events;
    if (!ev?.end_at) continue;
    const confArr = Array.isArray(raw.event_confirmations) ? raw.event_confirmations : [raw.event_confirmations];
    const conf = confArr[0];
    if (!conf || conf.status !== 'confirmed') continue;
    candidates.push({
      member_id: raw.member_id,
      event_api_id: raw.event_api_id,
      luma_events: {
        name: ev.name,
        end_at: ev.end_at,
        standard_ticket_price_twd: ev.standard_ticket_price_twd,
      },
      event_confirmations_row: {
        payment_method_id_snapshot: conf.payment_method_id_snapshot,
        stripe_customer_id_snapshot: conf.stripe_customer_id_snapshot,
      },
    });
  }
  stats.candidatesScanned = candidates.length;

  if (candidates.length === 0) return stats;

  // Filter out anyone who already has a no_show_charges row in any state.
  const existingKey = new Set<string>();
  {
    const { data: existing } = await supabaseServer
      .from('no_show_charges')
      .select('member_id, event_api_id')
      .in('event_api_id', Array.from(new Set(candidates.map((c) => c.event_api_id))));
    for (const row of (existing ?? []) as Array<{ member_id: number; event_api_id: string }>) {
      existingKey.add(`${row.member_id}::${row.event_api_id}`);
    }
  }

  for (const cand of candidates) {
    const key = `${cand.member_id}::${cand.event_api_id}`;
    if (existingKey.has(key)) continue;

    const price = cand.luma_events.standard_ticket_price_twd;
    if (!price || price <= 0) {
      // Free event — record as skipped so future runs don't re-scan.
      await supabaseServer.from('no_show_charges').insert({
        member_id: cand.member_id,
        event_api_id: cand.event_api_id,
        amount_twd: 0,
        status: 'skipped',
        failure_reason: 'no_standard_ticket',
      });
      stats.skipped += 1;
      continue;
    }

    const customerId = cand.event_confirmations_row.stripe_customer_id_snapshot;
    const paymentMethodId = cand.event_confirmations_row.payment_method_id_snapshot;
    if (!customerId || !paymentMethodId) {
      await supabaseServer.from('no_show_charges').insert({
        member_id: cand.member_id,
        event_api_id: cand.event_api_id,
        amount_twd: price,
        status: 'failed',
        failure_reason: 'missing_payment_snapshot',
      });
      stats.failed += 1;
      continue;
    }

    try {
      const pi = await chargeOffSessionTwd({
        customerId,
        paymentMethodId,
        amountTwd: price,
        statementDescriptorSuffix: 'TDF NOSHOW',
        idempotencyKey: `no-show-${cand.event_api_id}-${cand.member_id}`,
        metadata: {
          kind: 'tdf_no_show',
          event_api_id: cand.event_api_id,
          member_id: String(cand.member_id),
        },
      });
      await supabaseServer.from('no_show_charges').insert({
        member_id: cand.member_id,
        event_api_id: cand.event_api_id,
        amount_twd: price,
        stripe_payment_intent_id: pi.id,
        status: pi.status === 'succeeded' ? 'succeeded' : 'pending',
        charged_at: pi.status === 'succeeded' ? new Date().toISOString() : null,
      });
      stats.charged += 1;
    } catch (err) {
      await supabaseServer.from('no_show_charges').insert({
        member_id: cand.member_id,
        event_api_id: cand.event_api_id,
        amount_twd: price,
        status: 'failed',
        failure_reason: (err as Error).message.slice(0, 500),
      });
      stats.failed += 1;
    }
  }

  return stats;
}
