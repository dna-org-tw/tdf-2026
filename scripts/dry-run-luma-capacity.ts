/**
 * Dry-run preview of capacity-based auto-review. Replays the worker's decision
 * loop in memory for every upcoming event (or one specific event) and prints
 * what would change if we ran a real sync right now. NO writes to Luma. NO
 * writes to Supabase.
 *
 * Usage:
 *   npx tsx scripts/dry-run-luma-capacity.ts                  # all upcoming
 *   npx tsx scripts/dry-run-luma-capacity.ts evt-xxxxxxxx     # one event
 *   npx tsx scripts/dry-run-luma-capacity.ts --capped         # only events with cap
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createDecipheriv } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

for (const file of ['.env.production.local', '.env.local']) {
  let content: string;
  try {
    content = readFileSync(resolve(process.cwd(), file), 'utf-8');
  } catch {
    continue;
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function getCookie(): Promise<string> {
  const { data } = await supabase
    .from('luma_sync_config')
    .select('luma_session_cookie_enc, luma_session_cookie_iv, luma_session_cookie_tag')
    .eq('id', 1)
    .single();
  const key = Buffer.from(process.env.LUMA_COOKIE_ENCRYPTION_KEY!, 'hex');
  const enc = Buffer.from(data!.luma_session_cookie_enc, 'base64');
  const iv = Buffer.from(data!.luma_session_cookie_iv, 'base64');
  const tag = Buffer.from(data!.luma_session_cookie_tag, 'base64');
  const dec = createDecipheriv('aes-256-gcm', key, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(enc), dec.final()]).toString('utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const cappedOnly = args.includes('--capped');
  const eventArg = args.find((a) => a.startsWith('evt-')) ?? null;

  // Dynamic imports so env is loaded before lib modules read process.env.
  const { fetchEventDetail, fetchEventGuests } = await import('../lib/lumaApi');
  const { makeDecision, guestSortWeight, ticketWeight } = await import(
    '../lib/lumaAutoReview'
  );

  const cookie = await getCookie();

  let events: Array<{ event_api_id: string; name: string; start_at: string | null }>;
  if (eventArg) {
    events = [{ event_api_id: eventArg, name: '(from CLI arg)', start_at: null }];
  } else {
    const { data } = await supabase
      .from('luma_events')
      .select('event_api_id, name, start_at')
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true });
    events = data ?? [];
  }

  console.log(
    `\n=== Dry-run capacity preview (${events.length} event${events.length === 1 ? '' : 's'}) ===\n`,
  );

  const noShowConsumedExtra = new Map<string, number>();
  const summary: Array<{
    name: string;
    capacity: number | string;
    luma_approved: number;
    luma_other: number;
    would_approve: number;
    would_capacity_full: number;
    would_other_waitlist: number;
    overcap: number;
  }> = [];

  for (const ev of events) {
    let detail;
    try {
      detail = await fetchEventDetail(ev.event_api_id, cookie);
    } catch (err) {
      console.warn(`! ${ev.name} (${ev.event_api_id}): event-detail fetch failed — ${(err as Error).message}`);
      continue;
    }
    const capacity = detail.capacity;
    if (cappedOnly && capacity === null) continue;

    let guests;
    try {
      guests = await fetchEventGuests(ev.event_api_id, cookie);
    } catch (err) {
      console.warn(`! ${ev.name} (${ev.event_api_id}): guests fetch failed — ${(err as Error).message}`);
      continue;
    }

    type Row = {
      email: string;
      activity_status: string | null;
      ticket_type_name: string | null;
      event_ticket_type_api_id: string | null;
    };

    const mapped: Row[] = guests
      .map((g) => {
        const email = (g.email ?? '').trim().toLowerCase();
        if (!email) return null;
        const ticket = g.event_tickets?.[0];
        return {
          email,
          activity_status: g.approval_status ?? g.registration_status ?? null,
          ticket_type_name: ticket?.event_ticket_type_info?.name ?? null,
          event_ticket_type_api_id: ticket?.event_ticket_type_info?.api_id ?? null,
        } as Row;
      })
      .filter((r): r is Row => r !== null);

    const eventTicketTypes = (() => {
      const byApiId = new Map<string, { api_id: string; name: string; weight: number }>();
      for (const g of mapped) {
        if (!g.event_ticket_type_api_id || !g.ticket_type_name) continue;
        if (byApiId.has(g.event_ticket_type_api_id)) continue;
        byApiId.set(g.event_ticket_type_api_id, {
          api_id: g.event_ticket_type_api_id,
          name: g.ticket_type_name,
          weight: ticketWeight(g.ticket_type_name),
        });
      }
      return [...byApiId.values()];
    })();

    const hasTdfTicket = eventTicketTypes.some((t) => t.weight > 0);
    if (!hasTdfTicket) {
      // Worker would skip this event entirely; report briefly.
      console.log(`- ${ev.name.padEnd(50)} cap=${capacity ?? '∞'}  [no TDF ticket — sync skips]`);
      continue;
    }

    mapped.sort((a, b) => {
      const aA = a.activity_status === 'approved' ? 1 : 0;
      const bA = b.activity_status === 'approved' ? 1 : 0;
      if (aA !== bA) return bA - aA;
      return guestSortWeight(b.ticket_type_name) - guestSortWeight(a.ticket_type_name);
    });

    let approvedCount = 0;
    let wouldApprove = 0;
    let wouldCapacityFull = 0;
    let wouldOtherWaitlist = 0;
    const lumaApproved = mapped.filter((r) => r.activity_status === 'approved').length;
    const lumaOther = mapped.length - lumaApproved;
    const changes: string[] = [];

    const REVIEWABLE_STATUSES = new Set(['approved', 'waitlist', 'pending_approval']);
    for (const row of mapped) {
      // Mirror worker allowlist: only reviewable states get re-evaluated.
      if (row.activity_status !== null && !REVIEWABLE_STATUSES.has(row.activity_status)) continue;
      let decision;
      try {
        decision = await makeDecision(
          {
            email: row.email,
            event_api_id: ev.event_api_id,
            ticket_type_name: row.ticket_type_name,
            current_ticket_type_api_id: row.event_ticket_type_api_id,
          },
          eventTicketTypes,
          noShowConsumedExtra,
        );
      } catch (err) {
        console.warn(`  decision skip ${row.email}: ${(err as Error).message}`);
        continue;
      }

      if (decision.status === 'approved') {
        const wasApproved = row.activity_status === 'approved';
        if (capacity !== null && approvedCount >= capacity && !wasApproved) {
          decision = { status: 'waitlist' as const, reason: 'waitlist:capacity_full' };
          wouldCapacityFull += 1;
        } else {
          approvedCount += 1;
          if (!wasApproved) wouldApprove += 1;
        }
      } else if (row.activity_status !== decision.status) {
        wouldOtherWaitlist += 1;
      }

      if (row.activity_status !== decision.status) {
        changes.push(
          `    ${row.email}  ${row.activity_status ?? '—'} → ${decision.status}  [${decision.reason}]`,
        );
      }
    }

    const overcap = capacity !== null && approvedCount > capacity ? approvedCount - capacity : 0;
    const capStr = capacity === null ? '∞' : String(capacity);

    console.log(
      `- ${ev.name.padEnd(50)} cap=${capStr.padEnd(4)}  luma_approved=${String(lumaApproved).padEnd(3)} → next_sync_approved=${approvedCount}  +approve=${wouldApprove} cap_full=${wouldCapacityFull} other_wait=${wouldOtherWaitlist}${overcap > 0 ? `  ⚠️ OVERCAP +${overcap}` : ''}`,
    );

    summary.push({
      name: ev.name,
      capacity: capStr,
      luma_approved: lumaApproved,
      luma_other: lumaOther,
      would_approve: wouldApprove,
      would_capacity_full: wouldCapacityFull,
      would_other_waitlist: wouldOtherWaitlist,
      overcap,
    });

    if (changes.length > 0 && changes.length <= 30) {
      for (const c of changes) console.log(c);
    } else if (changes.length > 30) {
      console.log(`    (${changes.length} changes — first 5:)`);
      for (const c of changes.slice(0, 5)) console.log(c);
    }
  }

  // Aggregate
  const cappedEvents = summary.filter((s) => s.capacity !== '∞');
  const totalCapForced = summary.reduce((a, s) => a + s.would_capacity_full, 0);
  const totalApprove = summary.reduce((a, s) => a + s.would_approve, 0);
  const totalOvercap = summary.filter((s) => s.overcap > 0);
  console.log(`\n=== Summary ===`);
  console.log(`Events processed: ${summary.length}`);
  console.log(`  with capacity:  ${cappedEvents.length}`);
  console.log(`  no capacity:    ${summary.length - cappedEvents.length}`);
  console.log(`Would newly approve: ${totalApprove}`);
  console.log(`Would force-waitlist (capacity_full): ${totalCapForced}`);
  if (totalOvercap.length > 0) {
    console.log(`\n⚠️  ${totalOvercap.length} event(s) currently OVER capacity on Luma:`);
    for (const e of totalOvercap) {
      console.log(`   - ${e.name}  cap=${e.capacity}  approved=${e.luma_approved}  (over by ${e.overcap})`);
    }
    console.log(`   No demotions: existing approvals stay; only new sign-ups will be force-waitlisted.`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
