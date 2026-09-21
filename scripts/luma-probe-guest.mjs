/**
 * One-off: fetch the current Luma-side state of a single guest to compare
 * against our local luma_guests mirror. Runs under plain node (no tsx).
 *
 *   node scripts/luma-probe-guest.mjs <event_api_id> <email>
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createDecipheriv } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Load .env.local into process.env
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
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function fromB64(v) {
  return v ? Buffer.from(v, 'base64') : null;
}

async function getLumaCookie() {
  const { data, error } = await supabase
    .from('luma_sync_config')
    .select('luma_session_cookie_enc, luma_session_cookie_iv, luma_session_cookie_tag')
    .eq('id', 1)
    .single();
  if (error) throw error;
  if (!data?.luma_session_cookie_enc) throw new Error('no_cookie');
  const keyHex = process.env.LUMA_COOKIE_ENCRYPTION_KEY;
  const key = Buffer.from(keyHex, 'hex');
  const enc = fromB64(data.luma_session_cookie_enc);
  const iv = fromB64(data.luma_session_cookie_iv);
  const tag = fromB64(data.luma_session_cookie_tag);
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

async function fetchEventGuests(eventApiId, cookie) {
  const guests = [];
  let cursor = null;
  for (let page = 0; page < 50; page++) {
    const params = new URLSearchParams({
      event_api_id: eventApiId,
      pagination_limit: '100',
    });
    if (cursor) params.set('pagination_cursor', cursor);
    const res = await fetch(
      `https://api2.luma.com/event/admin/get-guests?${params}`,
      { headers: { ...BASE_HEADERS, Cookie: cookie }, cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`luma_http_${res.status}`);
    const data = await res.json();
    for (const g of data.entries ?? []) if (g) guests.push(g);
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return guests;
}

async function main() {
  const eventApiId = process.argv[2];
  const email = (process.argv[3] ?? '').toLowerCase().trim();
  if (!eventApiId || !email) {
    console.error('usage: node scripts/luma-probe-guest.mjs <event_api_id> <email>');
    process.exit(1);
  }

  const cookie = await getLumaCookie();
  const guests = await fetchEventGuests(eventApiId, cookie);
  const match = guests.find((g) => (g.email ?? '').toLowerCase().trim() === email);
  if (!match) {
    console.log(JSON.stringify({ found: false, email, eventApiId }, null, 2));
    return;
  }

  console.log(
    JSON.stringify(
      {
        found: true,
        email,
        eventApiId,
        luma_guest_api_id: match.api_id,
        approval_status: match.approval_status,
        registration_status: match.registration_status,
        registered_at: match.registered_at,
        checked_in_at: match.checked_in_at,
        ticket: match.event_tickets?.[0] ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
