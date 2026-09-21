/**
 * One-shot: retroactively move guests previously declined as `tier_mismatch`
 * (job 11) to `waitlist`, both on Luma and locally, after the spec change
 * "tier 不足 → waitlist" landed.
 *
 * Selects luma_guests rows whose CURRENT activity_status is still 'declined'
 * AND whose latest review_log entry is reason='declined:tier_mismatch'.
 * For each: calls Luma updateGuestStatus → 'waitlist', updates local row,
 * appends an audit log row reasoned 'waitlist:tier_mismatch_retro'.
 *
 * Usage:  npx tsx scripts/luma-flip-tier-mismatch-to-waitlist.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createDecipheriv } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// --- env loader (matches the pattern used by sibling scripts) ---
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

// --- helpers ---
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

async function pushToWaitlist(
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
      approval_status: 'waitlist',
      should_refund: false,
      event_ticket_type_api_id: null,
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`luma_http_${res.status}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- main ---
async function main() {
  console.log(`[flip] selecting all declined guests with a tier_mismatch log entry…`);

  const { data: logRows, error: logErr } = await supabase
    .from('luma_review_log')
    .select('event_api_id, email')
    .eq('reason', 'declined:tier_mismatch');
  if (logErr) throw logErr;

  const targetKeys = new Set((logRows ?? []).map((r) => `${r.event_api_id}|${r.email.toLowerCase()}`));

  // Only flip guests CURRENTLY still 'declined' — those whose state moved on
  // (member upgraded tier, manually approved, etc.) we leave alone.
  const { data: declined, error: gErr } = await supabase
    .from('luma_guests')
    .select('id, event_api_id, email, luma_guest_api_id, activity_status, member_id, ticket_type_name')
    .eq('activity_status', 'declined');
  if (gErr) throw gErr;

  const flipTargets = (declined ?? []).filter((g) =>
    targetKeys.has(`${g.event_api_id}|${g.email.toLowerCase()}`),
  );

  console.log(`[flip] ${flipTargets.length} guests to flip → waitlist`);
  if (flipTargets.length === 0) {
    console.log('[flip] nothing to do.');
    return;
  }

  const cookie = await getLumaCookie();
  console.log('[flip] cookie decrypted, starting…');

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < flipTargets.length; i++) {
    const g = flipTargets[i];
    const tag = `${i + 1}/${flipTargets.length}`;
    try {
      if (!g.luma_guest_api_id) {
        console.warn(`[flip] ${tag} ${g.email} (event ${g.event_api_id}): no luma_guest_api_id, skip`);
        failed++;
        continue;
      }
      await pushToWaitlist(cookie, g.event_api_id, g.luma_guest_api_id);
      const { error: upErr } = await supabase
        .from('luma_guests')
        .update({ activity_status: 'waitlist' })
        .eq('id', g.id);
      if (upErr) throw upErr;

      const { error: logInsErr } = await supabase.from('luma_review_log').insert({
        job_id: null,
        event_api_id: g.event_api_id,
        email: g.email.toLowerCase().trim(),
        member_id: g.member_id ?? null,
        luma_guest_api_id: g.luma_guest_api_id,
        previous_status: 'declined',
        new_status: 'waitlist',
        reason: 'waitlist:tier_mismatch_retro',
        consumed_no_show_event_api_id: null,
      });
      if (logInsErr) throw logInsErr;

      ok++;
      console.log(`[flip] ${tag} ${g.email} (${g.ticket_type_name ?? '—'}) → waitlist`);
    } catch (err) {
      failed++;
      console.error(`[flip] ${tag} ${g.email} FAILED:`, (err as Error).message);
    }
    await sleep(400); // ~2.5 req/s, well under Luma rate limit
  }

  console.log(`\n[flip] done. ok=${ok} failed=${failed}`);
}

main().catch((e) => {
  console.error('[flip] fatal:', e);
  process.exit(1);
});
