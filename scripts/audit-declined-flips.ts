/**
 * Audit historical declined→approved (and declined→waitlist) review_log
 * entries: list each affected member + event with as much signal as we can
 * gather, so the operator can judge per case whether it was likely an admin
 * decline (legitimate to upgrade) or a user self-cancellation (we forced
 * them back into the event).
 *
 * Pure read; no writes.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createDecipheriv } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

for (const f of ['.env.production.local', '.env.local']) {
  let c: string;
  try {
    c = readFileSync(resolve(process.cwd(), f), 'utf-8');
  } catch {
    continue;
  }
  for (const line of c.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i),
      v = t.slice(i + 1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function getCookie(): Promise<string> {
  const { data } = await sb
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

interface LogRow {
  id: number;
  job_id: number | null;
  event_api_id: string;
  email: string;
  previous_status: string;
  new_status: string;
  reason: string;
  created_at: string;
}

interface LumaGuestSnapshot {
  approval_status?: string | null;
  registration_status?: string | null;
  decline_message?: string | null;
  joined_at?: string | null;
  registered_at?: string | null;
  has_joined_event?: boolean;
  invited_at?: string | null;
  api_id?: string;
}

async function main() {
  const { fetchEventGuests } = await import('../lib/lumaApi');

  const { data: logs } = await sb
    .from('luma_review_log')
    .select('id, job_id, event_api_id, email, previous_status, new_status, reason, created_at')
    .eq('previous_status', 'declined')
    .order('created_at', { ascending: false });

  if (!logs || logs.length === 0) {
    console.log('No declined→* transitions in review_log.');
    return;
  }

  console.log(`Found ${logs.length} log entries with previous_status='declined'\n`);

  // Group by (email, event)
  const byKey = new Map<string, LogRow[]>();
  for (const l of logs as LogRow[]) {
    const k = `${l.email}::${l.event_api_id}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(l);
  }

  console.log(`Distinct (member, event) pairs affected: ${byKey.size}\n`);

  const cookie = await getCookie();

  // Also fetch event names + earliest review_log for each (email, event) to
  // see if we have any prior history (e.g. they were 'pending_approval' first
  // and we declined them — though our makeDecision never produces 'declined',
  // this serves as a sanity check).
  const { data: events } = await sb
    .from('luma_events')
    .select('event_api_id, name, start_at');
  const eventMap = new Map<string, { name: string; start_at: string | null }>();
  for (const e of events ?? []) eventMap.set(e.event_api_id, { name: e.name, start_at: e.start_at });

  console.log('=== Per-case audit ===\n');

  let suspectedSelfCancel = 0;
  let likelyAdminDecline = 0;
  let unclear = 0;

  for (const [key, rows] of byKey.entries()) {
    const [email, eventApiId] = key.split('::');
    const ev = eventMap.get(eventApiId);
    const flips = rows.map((r) => `${r.previous_status}→${r.new_status} [${r.reason}] @${r.created_at.slice(0, 19)}`).join('  ');

    // Current state
    const { data: cur } = await sb
      .from('luma_guests')
      .select('activity_status, registered_at, last_synced_at')
      .eq('email', email)
      .eq('event_api_id', eventApiId)
      .maybeSingle();

    // Are there any prior log entries for this (email, event) that landed at 'declined'?
    // If our system never produced 'declined', these should all be empty.
    const { data: priors } = await sb
      .from('luma_review_log')
      .select('previous_status, new_status, reason, created_at')
      .eq('email', email)
      .eq('event_api_id', eventApiId)
      .eq('new_status', 'declined');
    const ourSystemDeclined = (priors ?? []).length > 0;

    // Live Luma data
    let live: LumaGuestSnapshot | null = null;
    try {
      const guests = await fetchEventGuests(eventApiId, cookie);
      live = (guests.find((g) => (g.email ?? '').toLowerCase() === email.toLowerCase()) ?? null) as LumaGuestSnapshot | null;
    } catch {
      // ignore
    }

    // Heuristic classification:
    // - If our system has no record of declining them (priors empty), the
    //   decline must have come from outside our system. That's most likely
    //   a self-cancel (admins rarely manually decline).
    // - If priors exist (we did decline them), it was our action, no concern.
    // - If we don't have decline_message and no admin signature, treat as
    //   suspected self-cancel.
    let verdict: string;
    if (ourSystemDeclined) {
      verdict = '✓ admin/system decline (we declined them; later upgraded — fine)';
      likelyAdminDecline += 1;
    } else if (live?.decline_message) {
      verdict = `? has decline_message: "${live.decline_message}"`;
      unclear += 1;
    } else {
      verdict = '⚠️  SUSPECTED SELF-CANCEL (decline came from outside our system)';
      suspectedSelfCancel += 1;
    }

    console.log(`▸ ${email}`);
    console.log(`  event:   ${ev?.name ?? eventApiId}  (${ev?.start_at?.slice(0, 10) ?? '?'})`);
    console.log(`  flips:   ${flips}`);
    console.log(`  now:     activity_status=${cur?.activity_status ?? '(deleted)'}  registered=${cur?.registered_at?.slice(0, 19) ?? '?'}`);
    if (live) {
      console.log(
        `  luma:    approval=${live.approval_status ?? '?'}  decline_message=${live.decline_message ?? '∅'}  joined_at=${live.joined_at?.slice(0, 19) ?? '?'}  invited_at=${live.invited_at?.slice(0, 19) ?? '∅'}`,
      );
    } else {
      console.log(`  luma:    (not in current roster)`);
    }
    console.log(`  ${verdict}`);
    console.log();
  }

  console.log('=== Summary ===');
  console.log(`  Total cases:                  ${byKey.size}`);
  console.log(`  ✓ Likely OK (we declined):    ${likelyAdminDecline}`);
  console.log(`  ⚠️  Suspected self-cancel:     ${suspectedSelfCancel}`);
  console.log(`  ?  Unclear (decline_message): ${unclear}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
