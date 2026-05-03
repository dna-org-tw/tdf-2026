/**
 * One-shot: re-approve the small set of users who went from going (approved)
 * to not-going (waitlist / declined) because of the wrongful no-show penalty
 * cascade. After deleting the bad luma_review_log rows and shipping soft-mode
 * + post-cutoff skip, three constraints decide who actually gets restored:
 *
 *   1. Event start_at must be in the future.
 *   2. Event must NOT be past its approve cutoff (lumaCutoff.isPastCutoff).
 *   3. Event must have available capacity (approved_count < capacity).
 *
 * Anyone failing any of those is left as-is — the user's instruction was
 * "尚未 cutoff" and "capacity 不夠的也不行".
 *
 * Source list is hardcoded (the 21 deleted + 2 kept penalty rows). Re-running
 * is safe: skips users already approved or events that have since passed
 * cutoff / filled up.
 *
 * Usage:  npx tsx scripts/luma-restore-penalty-victims.ts [--dry-run]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createDecipheriv } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { isPastCutoff } from '../lib/lumaCutoff';

// Load .env.production.local first (prod cookie is encrypted with the prod
// key), then fall back to .env.local for any missing vars.
for (const file of ['.env.production.local', '.env.local']) {
  let body: string;
  try {
    body = readFileSync(resolve(process.cwd(), file), 'utf-8');
  } catch {
    continue;
  }
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// (email, event_api_id) of every penalty victim — i.e. anyone whose worker
// review pushed waitlist:no_show_penalty between the bug's introduction and
// the cleanup. Reconstructed from the deleted luma_review_log rows.
const VICTIM_PAIRS: Array<{ email: string; event_api_id: string }> = [
  { email: 'kk@dna.org.tw', event_api_id: 'evt-DkIokJLcuHrYyFs' },
  { email: 'a.goh@outlook.sg', event_api_id: 'evt-DkIokJLcuHrYyFs' },
  { email: 'mr@marcinros.net', event_api_id: 'evt-DkIokJLcuHrYyFs' },
  { email: 'hey@mydailyjourneys.com', event_api_id: 'evt-DkIokJLcuHrYyFs' },
  { email: 'angelrabbit0612@gmail.com', event_api_id: 'evt-OvgrMBikgFJWtce' },
  { email: 'toks@tokstravels.com', event_api_id: 'evt-yQCdidpQesAkVHi' },
  { email: 'kenzocast@gmail.com', event_api_id: 'evt-udwFNI9yl7JgJzy' },
  { email: 'aubreyrhose12@gmail.com', event_api_id: 'evt-udwFNI9yl7JgJzy' },
  { email: 'bethanyruhl@gmail.com', event_api_id: 'evt-k2LIledfVWLv9Y1' },
  { email: 'supermeitravel@gmail.com', event_api_id: 'evt-k2LIledfVWLv9Y1' },
  { email: 'bensherry.ed@gmail.com', event_api_id: 'evt-43bcnresAC7JcGf' },
  { email: 'benitanatsu@gmail.com', event_api_id: 'evt-hFwiTAiNEHNjXnf' },
  { email: '0973661805kt@gmail.com', event_api_id: 'evt-DkIokJLcuHrYyFs' },
  { email: 'felixtanhm@gmail.com', event_api_id: 'evt-DkIokJLcuHrYyFs' },
  { email: 'felixtanhm@gmail.com', event_api_id: 'evt-zn1egrwq0LxZ4we' },
  { email: 'supermeitravel@gmail.com', event_api_id: 'evt-zn1egrwq0LxZ4we' },
  { email: 'martin.fisnar@gmail.com', event_api_id: 'evt-aSFhpDF5NMs1MyO' },
  { email: 'bensherry.ed@gmail.com', event_api_id: 'evt-l02P0zoN4nbeT0l' },
  { email: 'hey@mydailyjourneys.com', event_api_id: 'evt-udwFNI9yl7JgJzy' },
  { email: 'megan.aizhen@gmail.com', event_api_id: 'evt-DkIokJLcuHrYyFs' },
  { email: 'bojiehuang0811@gmail.com', event_api_id: 'evt-43bcnresAC7JcGf' },
  { email: 'pmedia.christian@gmail.com', event_api_id: 'evt-j7zuudVVbxctNLz' },
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

interface Candidate {
  email: string;
  event_api_id: string;
  event_name: string;
  start_at: string;
  capacity: number | null;
  approved_count: number;
  current_status: string | null;
  luma_guest_api_id: string | null;
  member_id: number | null;
  guest_id: number | null;
  decision: 'recover' | 'skip_already_approved' | 'skip_no_record' | 'skip_no_guest_id' | 'skip_past_event' | 'skip_past_cutoff' | 'skip_capacity_full';
}

async function main() {
  const now = new Date();
  console.log(`[restore] decision time = ${now.toISOString()}`);

  // 1) Pull current state for every (email, event) pair: capacity, approved
  //    count, and the guest's current status / luma_guest_api_id.
  const eventIds = Array.from(new Set(VICTIM_PAIRS.map((v) => v.event_api_id)));
  const { data: events, error: evErr } = await supabase
    .from('luma_events')
    .select('event_api_id, name, start_at, capacity')
    .in('event_api_id', eventIds);
  if (evErr) throw evErr;
  const eventByIdRaw = (events ?? []) as {
    event_api_id: string;
    name: string;
    start_at: string | null;
    capacity: number | null;
  }[];
  const eventById = new Map(eventByIdRaw.map((e) => [e.event_api_id, e] as const));

  // approved_count per event (point-in-time; capacity gate uses this).
  const approvedByEvent = new Map<string, number>();
  for (const eid of eventIds) {
    const { count, error } = await supabase
      .from('luma_guests')
      .select('id', { count: 'exact', head: true })
      .eq('event_api_id', eid)
      .eq('activity_status', 'approved');
    if (error) throw error;
    approvedByEvent.set(eid, count ?? 0);
  }

  // Per-victim guest row.
  const emails = Array.from(new Set(VICTIM_PAIRS.map((v) => v.email.toLowerCase())));
  const { data: guests, error: gErr } = await supabase
    .from('luma_guests')
    .select('id, email, event_api_id, activity_status, luma_guest_api_id, member_id')
    .in('email', emails)
    .in('event_api_id', eventIds);
  if (gErr) throw gErr;
  const guestByKey = new Map<string, {
    id: number;
    activity_status: string | null;
    luma_guest_api_id: string | null;
    member_id: number | null;
  }>();
  for (const g of (guests ?? []) as Array<{
    id: number;
    email: string;
    event_api_id: string;
    activity_status: string | null;
    luma_guest_api_id: string | null;
    member_id: number | null;
  }>) {
    guestByKey.set(`${g.event_api_id}|${g.email.toLowerCase()}`, {
      id: g.id,
      activity_status: g.activity_status,
      luma_guest_api_id: g.luma_guest_api_id,
      member_id: g.member_id,
    });
  }

  // 2) Decide each candidate.
  const candidates: Candidate[] = [];
  for (const v of VICTIM_PAIRS) {
    const ev = eventById.get(v.event_api_id);
    const g = guestByKey.get(`${v.event_api_id}|${v.email.toLowerCase()}`);
    const base: Omit<Candidate, 'decision'> = {
      email: v.email,
      event_api_id: v.event_api_id,
      event_name: ev?.name ?? v.event_api_id,
      start_at: ev?.start_at ?? '',
      capacity: ev?.capacity ?? null,
      approved_count: approvedByEvent.get(v.event_api_id) ?? 0,
      current_status: g?.activity_status ?? null,
      luma_guest_api_id: g?.luma_guest_api_id ?? null,
      member_id: g?.member_id ?? null,
      guest_id: g?.id ?? null,
    };

    if (!g) {
      candidates.push({ ...base, decision: 'skip_no_record' });
      continue;
    }
    if (g.activity_status === 'approved') {
      candidates.push({ ...base, decision: 'skip_already_approved' });
      continue;
    }
    if (!g.luma_guest_api_id) {
      candidates.push({ ...base, decision: 'skip_no_guest_id' });
      continue;
    }
    if (!ev?.start_at || new Date(ev.start_at).getTime() <= now.getTime()) {
      candidates.push({ ...base, decision: 'skip_past_event' });
      continue;
    }
    if (isPastCutoff(ev.start_at, now)) {
      candidates.push({ ...base, decision: 'skip_past_cutoff' });
      continue;
    }
    const cap = ev.capacity;
    const approved = approvedByEvent.get(v.event_api_id) ?? 0;
    if (cap !== null && approved >= cap) {
      candidates.push({ ...base, decision: 'skip_capacity_full' });
      continue;
    }
    candidates.push({ ...base, decision: 'recover' });
  }

  // 3) Print plan.
  console.log('\n[restore] decisions:');
  for (const c of candidates) {
    const tag = c.decision.padEnd(22, ' ');
    const cap = c.capacity === null ? '∞' : `${c.approved_count}/${c.capacity}`;
    console.log(
      `  ${tag} ${c.email.padEnd(30, ' ')} @ ${c.event_name.slice(0, 50).padEnd(50, ' ')} cap=${cap} status=${c.current_status ?? '—'}`,
    );
  }

  const toRecover = candidates.filter((c) => c.decision === 'recover');
  console.log(`\n[restore] ${toRecover.length} to push approved, ${candidates.length - toRecover.length} skipped`);

  if (toRecover.length === 0) return;
  if (DRY_RUN) {
    console.log('[restore] --dry-run: stopping before Luma writes.');
    return;
  }

  const cookie = await getLumaCookie();
  console.log('[restore] cookie decrypted, pushing approvals…');

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < toRecover.length; i++) {
    const c = toRecover[i];
    const tag = `${i + 1}/${toRecover.length}`;
    try {
      await pushApproved(cookie, c.event_api_id, c.luma_guest_api_id!);

      const { error: upErr } = await supabase
        .from('luma_guests')
        .update({ activity_status: 'approved' })
        .eq('id', c.guest_id!);
      if (upErr) throw upErr;

      const { error: logErr } = await supabase.from('luma_review_log').insert({
        job_id: null,
        event_api_id: c.event_api_id,
        email: c.email.toLowerCase().trim(),
        member_id: c.member_id,
        luma_guest_api_id: c.luma_guest_api_id,
        previous_status: c.current_status ?? 'unknown',
        new_status: 'approved',
        reason: 'approved:non_tdf_penalty_revoked',
        consumed_no_show_event_api_id: null,
      });
      if (logErr) throw logErr;

      ok++;
      console.log(`[restore] ${tag} ${c.email} @ ${c.event_name} → approved`);
    } catch (err) {
      failed++;
      console.error(`[restore] ${tag} ${c.email} FAILED:`, (err as Error).message);
    }
    await sleep(400);
  }

  console.log(`\n[restore] done. ok=${ok} failed=${failed}`);
}

main().catch((e) => {
  console.error('[restore] fatal:', e);
  process.exit(1);
});
