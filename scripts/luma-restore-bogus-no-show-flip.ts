/**
 * One-shot remediation for the 2026-05-02 09:00 sync (job 534).
 *
 * The auto-review no-show query used `start_at < now()` and didn't exclude
 * the event currently being processed, so when sync ran microseconds after
 * Calavi Trip's start_at (09:00:00 UTC+8 = 01:00:00 UTC), the event itself
 * appeared in each guest's "past missed" list. Five approved guests with no
 * unconsumed prior no-show debt got flipped to waitlist with reason
 * `waitlist:no_show_penalty` — penalised for "missing" the very event they
 * were being reviewed for.
 *
 * This script:
 *  1. Pushes `approved` back to Luma for the five affected guests on
 *     Calavi Trip (evt-k2LIledfVWLv9Y1).
 *  2. Updates the local luma_guests row to mirror.
 *  3. Renames the five bogus review_log rows' reason from
 *     `waitlist:no_show_penalty` → `reverted:bogus_no_show_self_ref` so they
 *     no longer inflate future consumedCount calculations.
 *  4. Inserts an audit row reason=`approved:restored_bogus_no_show` per guest.
 *
 * Usage:  npx tsx scripts/luma-restore-bogus-no-show-flip.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createDecipheriv } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const envPath = resolve(process.cwd(), '.env.production.local');
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

const TARGET_EVENT_API_ID = 'evt-k2LIledfVWLv9Y1';
const BOGUS_JOB_ID = 534;
const TARGET_EMAILS = [
  '0973661805kt@gmail.com',
  'bethanyruhl@gmail.com',
  'felixtanhm@gmail.com',
  'lokolaman@gmail.com',
  'supermeitravel@gmail.com',
];

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

async function pushToApproved(
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
  console.log('[restore] selecting bogusly-waitlisted guests on Calavi Trip…');

  const { data: guests, error: gErr } = await supabase
    .from('luma_guests')
    .select('id, event_api_id, email, luma_guest_api_id, activity_status, member_id, ticket_type_name')
    .eq('event_api_id', TARGET_EVENT_API_ID)
    .in('email', TARGET_EMAILS);
  if (gErr) throw gErr;

  if (!guests || guests.length === 0) {
    console.log('[restore] no matching guests; aborting.');
    return;
  }

  const stillWaitlisted = guests.filter((g) => g.activity_status === 'waitlist');
  console.log(
    `[restore] found ${guests.length} target rows, ${stillWaitlisted.length} still waitlist`,
  );

  if (stillWaitlisted.length === 0) {
    console.log('[restore] nothing to push to Luma; will only neutralize log rows.');
  }

  const cookie = await getLumaCookie();

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < stillWaitlisted.length; i++) {
    const g = stillWaitlisted[i];
    const tag = `${i + 1}/${stillWaitlisted.length}`;
    try {
      if (!g.luma_guest_api_id) {
        console.warn(`[restore] ${tag} ${g.email}: no luma_guest_api_id, skip`);
        failed++;
        continue;
      }
      await pushToApproved(cookie, g.event_api_id, g.luma_guest_api_id);

      const { error: upErr } = await supabase
        .from('luma_guests')
        .update({ activity_status: 'approved' })
        .eq('id', g.id);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('luma_review_log').insert({
        job_id: null,
        event_api_id: g.event_api_id,
        email: g.email.toLowerCase().trim(),
        member_id: g.member_id ?? null,
        luma_guest_api_id: g.luma_guest_api_id,
        previous_status: 'waitlist',
        new_status: 'approved',
        reason: 'approved:restored_bogus_no_show',
        consumed_no_show_event_api_id: null,
      });
      if (insErr) throw insErr;

      ok++;
      console.log(`[restore] ${tag} ${g.email} → approved`);
    } catch (err) {
      failed++;
      console.error(`[restore] ${tag} ${g.email} FAILED:`, (err as Error).message);
    }
    await sleep(400);
  }

  console.log(`[restore] Luma push: ok=${ok} failed=${failed}`);

  console.log('[restore] neutralizing bogus review_log rows from job', BOGUS_JOB_ID);
  const { data: bogusRows, error: bogErr } = await supabase
    .from('luma_review_log')
    .select('id, email')
    .eq('job_id', BOGUS_JOB_ID)
    .eq('event_api_id', TARGET_EVENT_API_ID)
    .eq('reason', 'waitlist:no_show_penalty');
  if (bogErr) throw bogErr;

  if (!bogusRows || bogusRows.length === 0) {
    console.log('[restore] no bogus review_log rows found (may have been cleaned already).');
  } else {
    const { error: updErr } = await supabase
      .from('luma_review_log')
      .update({ reason: 'reverted:bogus_no_show_self_ref' })
      .in('id', bogusRows.map((r) => r.id));
    if (updErr) throw updErr;
    console.log(`[restore] neutralized ${bogusRows.length} review_log rows.`);
  }

  console.log('[restore] done.');
}

main().catch((e) => {
  console.error('[restore] fatal:', e);
  process.exit(1);
});
