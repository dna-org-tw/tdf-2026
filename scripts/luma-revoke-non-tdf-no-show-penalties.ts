/**
 * One-shot recovery for the "non-TDF event causes no-show penalty" bug.
 *
 * Background: getNoShowData was counting no-shows on every approved + not-
 * checked-in event in luma_guests, including events whose ticket types lack
 * the "TDF *" prefix (open events where check-in often isn't even enforced).
 * Those penalties bumped legitimate TDF-eligible guests onto waitlist; some
 * later collapsed to declined via the cutoff override.
 *
 * Code fix (lib/lumaAutoReview.ts) now filters out non-TDF events. This
 * script handles the stuck `declined` consequence: any user currently
 * declined on a FUTURE TDF event whose only penalty came from a non-TDF
 * source event gets pushed back to `approved` on Luma (they were originally
 * eligible — the penalty was the only thing that knocked them off).
 *
 * Past events are left alone (can't undo attendance after the fact).
 * Bad luma_review_log rows are deleted separately via direct SQL.
 *
 * Usage:  npx tsx scripts/luma-revoke-non-tdf-no-show-penalties.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createDecipheriv } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = val;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const TDF_TICKET_NAMES = ['TDF Follower', 'TDF Explorer', 'TDF Contributor', 'TDF Backer'];

function fromB64(v: string | null): Buffer | null {
  return v ? Buffer.from(v, 'base64') : null;
}

async function getLumaCookie(): Promise<string> {
  const { data, error } = await supabase
    .from('luma_sync_config')
    .select('luma_session_cookie_enc, luma_session_cookie_iv, luma_session_cookie_tag')
    .eq('id', 1)
    .single();
  if (error) throw error;
  if (!data?.luma_session_cookie_enc) throw new Error('no_cookie');
  const keyHex = process.env.LUMA_COOKIE_ENCRYPTION_KEY!;
  const key = Buffer.from(keyHex, 'hex');
  const enc = fromB64(data.luma_session_cookie_enc)!;
  const iv = fromB64(data.luma_session_cookie_iv)!;
  const tag = fromB64(data.luma_session_cookie_tag)!;
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

const BASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://lu.ma',
  Referer: 'https://lu.ma/',
};

async function pushApproved(
  cookie: string,
  eventApiId: string,
  rsvpApiId: string,
): Promise<void> {
  const res = await fetch('https://api2.luma.com/event/admin/update-guest-status', {
    method: 'POST',
    headers: { ...BASE_HEADERS, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_api_id: eventApiId,
      rsvp_api_id: rsvpApiId,
      approval_status: 'approved',
      should_refund: false,
      event_ticket_type_api_id: null,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`luma_http_${res.status}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Find candidates: declined guests on FUTURE TDF events whose review_log
  // shows the latest entry is a no_show_penalty whose consumed_no_show source
  // is a non-TDF event.
  const nowIso = new Date().toISOString();

  // 1) The set of TDF event_api_ids (events with at least one TDF ticket guest).
  const { data: tdfEventRows, error: tdfErr } = await supabase
    .from('luma_guests')
    .select('event_api_id')
    .in('ticket_type_name', TDF_TICKET_NAMES);
  if (tdfErr) throw tdfErr;
  const tdfEventIds = new Set(
    (tdfEventRows ?? []).map((r: { event_api_id: string }) => r.event_api_id),
  );

  // 2) Penalty rows where consumed source is a non-TDF event.
  const { data: penaltyRows, error: pErr } = await supabase
    .from('luma_review_log')
    .select('email, event_api_id, consumed_no_show_event_api_id, created_at')
    .eq('reason', 'waitlist:no_show_penalty');
  if (pErr) throw pErr;

  const badPenalties = (penaltyRows ?? []).filter(
    (p: { consumed_no_show_event_api_id: string | null }) =>
      p.consumed_no_show_event_api_id && !tdfEventIds.has(p.consumed_no_show_event_api_id),
  );
  console.log(`[revoke] ${badPenalties.length} penalty rows from non-TDF source events`);

  // 3) For each (email, dest event), find the user's current luma_guests row.
  //    Only act on FUTURE TDF dest events that are currently declined.
  type PenaltyKey = { email: string; event_api_id: string };
  const targetKeys: PenaltyKey[] = badPenalties.map((p: { email: string; event_api_id: string }) => ({
    email: p.email.toLowerCase().trim(),
    event_api_id: p.event_api_id,
  }));
  if (targetKeys.length === 0) {
    console.log('[revoke] nothing to recover.');
    return;
  }

  const destEventIds = Array.from(new Set(targetKeys.map((k) => k.event_api_id)));
  const { data: destEvents, error: deErr } = await supabase
    .from('luma_events')
    .select('event_api_id, name, start_at')
    .in('event_api_id', destEventIds);
  if (deErr) throw deErr;
  const eventByIdRaw = (destEvents ?? []) as {
    event_api_id: string;
    name: string;
    start_at: string | null;
  }[];
  const eventById = new Map(eventByIdRaw.map((e) => [e.event_api_id, e] as const));

  const futureDestEventIds = new Set(
    eventByIdRaw
      .filter((e) => e.start_at && e.start_at > nowIso && tdfEventIds.has(e.event_api_id))
      .map((e) => e.event_api_id),
  );

  const { data: guestRows, error: gErr } = await supabase
    .from('luma_guests')
    .select('id, event_api_id, email, luma_guest_api_id, activity_status, member_id, ticket_type_name')
    .in('email', Array.from(new Set(targetKeys.map((k) => k.email))))
    .in('event_api_id', destEventIds);
  if (gErr) throw gErr;

  const guestByKey = new Map<string, (typeof guestRows)[number]>();
  for (const g of (guestRows ?? []) as Array<{
    id: number;
    event_api_id: string;
    email: string;
    luma_guest_api_id: string | null;
    activity_status: string | null;
    member_id: number | null;
    ticket_type_name: string | null;
  }>) {
    guestByKey.set(`${g.event_api_id}|${g.email.toLowerCase()}`, g);
  }

  const recoveryTargets: Array<{
    id: number;
    email: string;
    event_api_id: string;
    event_name: string;
    luma_guest_api_id: string;
    member_id: number | null;
  }> = [];

  for (const k of targetKeys) {
    if (!futureDestEventIds.has(k.event_api_id)) continue;
    const g = guestByKey.get(`${k.event_api_id}|${k.email}`);
    if (!g) continue;
    if (g.activity_status !== 'declined') continue;
    if (!g.luma_guest_api_id) continue;
    recoveryTargets.push({
      id: g.id,
      email: g.email,
      event_api_id: g.event_api_id,
      event_name: eventById.get(g.event_api_id)?.name ?? g.event_api_id,
      luma_guest_api_id: g.luma_guest_api_id,
      member_id: g.member_id,
    });
  }

  console.log(`[revoke] ${recoveryTargets.length} declined recoveries on future TDF events:`);
  for (const t of recoveryTargets) {
    console.log(`  - ${t.email} → ${t.event_name} (${t.event_api_id})`);
  }
  if (recoveryTargets.length === 0) return;

  const cookie = await getLumaCookie();
  console.log('[revoke] cookie decrypted, pushing approvals…');

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < recoveryTargets.length; i++) {
    const t = recoveryTargets[i];
    const tag = `${i + 1}/${recoveryTargets.length}`;
    try {
      await pushApproved(cookie, t.event_api_id, t.luma_guest_api_id);

      const { error: upErr } = await supabase
        .from('luma_guests')
        .update({ activity_status: 'approved' })
        .eq('id', t.id);
      if (upErr) throw upErr;

      const { error: logErr } = await supabase.from('luma_review_log').insert({
        job_id: null,
        event_api_id: t.event_api_id,
        email: t.email.toLowerCase().trim(),
        member_id: t.member_id,
        luma_guest_api_id: t.luma_guest_api_id,
        previous_status: 'declined',
        new_status: 'approved',
        reason: 'approved:non_tdf_penalty_revoked',
        consumed_no_show_event_api_id: null,
      });
      if (logErr) throw logErr;

      ok++;
      console.log(`[revoke] ${tag} ${t.email} @ ${t.event_name} → approved`);
    } catch (err) {
      failed++;
      console.error(`[revoke] ${tag} ${t.email} FAILED:`, (err as Error).message);
    }
    await sleep(400);
  }

  console.log(`\n[revoke] done. ok=${ok} failed=${failed}`);
}

main().catch((e) => {
  console.error('[revoke] fatal:', e);
  process.exit(1);
});
