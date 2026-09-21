/**
 * Probe Luma calendar feed (the same call our sync worker uses) and report
 * which events are returned vs missing. Reads encrypted cookie from env.
 *
 *   LUMA_COOKIE_ENC_B64=... LUMA_COOKIE_IV_B64=... LUMA_COOKIE_TAG_B64=... \
 *     node scripts/luma-probe-calendar.mjs [evt-id1,evt-id2,...]
 *
 * Optional comma-separated list of event_api_ids to specifically check
 * presence of.
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
  const keyHex = process.env.LUMA_COOKIE_ENCRYPTION_KEY;
  const key = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, fromB64(ivB64));
  decipher.setAuthTag(fromB64(tagB64));
  return Buffer.concat([decipher.update(fromB64(encB64)), decipher.final()]).toString('utf8');
}

const CALENDAR_API_ID = 'cal-S2KwfjOEzcZl8E8';

const BASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://lu.ma',
  Referer: 'https://lu.ma/',
};

async function fetchCalendar(period, cookie) {
  const items = [];
  let cursor = null;
  let pages = 0;
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      calendar_api_id: CALENDAR_API_ID,
      pagination_limit: '100',
      period,
    });
    if (cursor) params.set('pagination_cursor', cursor);
    const res = await fetch(`https://api2.luma.com/calendar/get-items?${params}`, {
      headers: { ...BASE_HEADERS, Cookie: cookie },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`luma_http_${res.status}`);
    const data = await res.json();
    pages = page + 1;
    for (const e of data.entries ?? []) items.push(e);
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return { items, pages };
}

async function main() {
  const required = (process.argv[2] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const cookie = decryptCookie();

  const periods = ['all', 'past', 'upcoming'];
  const result = {};
  for (const p of periods) {
    const { items, pages } = await fetchCalendar(p, cookie);
    const ids = items.map((it) => it.event.api_id);
    result[p] = {
      count: items.length,
      pages,
      hasRequired: Object.fromEntries(required.map((r) => [r, ids.includes(r)])),
      first3: items.slice(0, 3).map((it) => ({
        api_id: it.event.api_id,
        name: it.event.name,
        start_at: it.event.start_at,
      })),
      last3: items.slice(-3).map((it) => ({
        api_id: it.event.api_id,
        name: it.event.name,
        start_at: it.event.start_at,
      })),
    };
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
