/**
 * Probe how many guests in a Luma event have `checked_in_at` set on Luma's
 * side. Uses the encrypted cookie pre-fetched from luma_sync_config (passed
 * via env: LUMA_COOKIE_ENC_B64, LUMA_COOKIE_IV_B64, LUMA_COOKIE_TAG_B64) so
 * the script does not need a Supabase client.
 *
 *   node scripts/luma-probe-checkin.mjs <event_api_id>
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createDecipheriv } from 'node:crypto';

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

function fromB64(v) {
  return Buffer.from(v, 'base64');
}

function decryptCookie() {
  const encB64 = process.env.LUMA_COOKIE_ENC_B64;
  const ivB64 = process.env.LUMA_COOKIE_IV_B64;
  const tagB64 = process.env.LUMA_COOKIE_TAG_B64;
  if (!encB64 || !ivB64 || !tagB64) {
    throw new Error('missing LUMA_COOKIE_ENC_B64 / LUMA_COOKIE_IV_B64 / LUMA_COOKIE_TAG_B64');
  }
  const keyHex = process.env.LUMA_COOKIE_ENCRYPTION_KEY;
  if (!keyHex) throw new Error('missing LUMA_COOKIE_ENCRYPTION_KEY');
  const key = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, fromB64(ivB64));
  decipher.setAuthTag(fromB64(tagB64));
  return Buffer.concat([decipher.update(fromB64(encB64)), decipher.final()]).toString('utf8');
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
  if (!eventApiId) {
    console.error('usage: node scripts/luma-probe-checkin.mjs <event_api_id>');
    process.exit(1);
  }

  const cookie = decryptCookie();
  const guests = await fetchEventGuests(eventApiId, cookie);
  const withCheckin = guests.filter((g) => g.checked_in_at);
  const byStatus = guests.reduce((acc, g) => {
    const k = g.approval_status ?? g.registration_status ?? '(null)';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const ticketTypeNames = guests.map((g) => g.event_tickets?.[0]?.event_ticket_type_info?.name ?? null);
  const ticketTypeHistogram = ticketTypeNames.reduce((acc, name) => {
    const k = name ?? '(null)';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({
    eventApiId,
    totalGuests: guests.length,
    withCheckedInAt: withCheckin.length,
    byStatus,
    ticketTypeHistogram,
    firstWithCheckIn: withCheckin[0] ? {
      email: withCheckin[0].email,
      checked_in_at: withCheckin[0].checked_in_at,
      approval_status: withCheckin[0].approval_status,
      ticketName: withCheckin[0].event_tickets?.[0]?.event_ticket_type_info?.name ?? null,
    } : null,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
