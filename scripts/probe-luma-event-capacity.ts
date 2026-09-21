/**
 * Probe Luma's admin event-detail endpoint to discover the actual capacity
 * field name. Uses the cookie stored in luma_sync_config (same source as the
 * sync worker) so authentication state mirrors production exactly.
 *
 * Usage:
 *   npx tsx scripts/probe-luma-event-capacity.ts                  # auto-pick first upcoming event
 *   npx tsx scripts/probe-luma-event-capacity.ts evt-xxxxxxxx     # specific event
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createDecipheriv } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Prefer .env.production.local (Luma cookie & encryption key live in prod env);
// fall back to .env.local only for missing keys.
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

async function pickUpcomingEvent(): Promise<{ event_api_id: string; name: string; start_at: string | null }> {
  const { data, error } = await supabase
    .from('luma_events')
    .select('event_api_id, name, start_at')
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    const { data: any } = await supabase
      .from('luma_events')
      .select('event_api_id, name, start_at')
      .order('start_at', { ascending: false })
      .limit(1);
    if (!any || any.length === 0) throw new Error('no events in luma_events');
    return any[0];
  }
  return data[0];
}

const BASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://lu.ma',
  Referer: 'https://lu.ma/',
};

const ENDPOINTS = [
  // Most likely candidates, in priority order
  (id: string) => `https://api2.luma.com/event/admin/get?event_api_id=${id}`,
  (id: string) => `https://api2.luma.com/event/admin/get-event?event_api_id=${id}`,
  (id: string) => `https://api2.luma.com/event/get?event_api_id=${id}`,
  (id: string) => `https://api2.luma.com/event/get-event?event_api_id=${id}`,
];

interface ProbeResult {
  url: string;
  status: number;
  ok: boolean;
  bodyKeys: string[] | null;
  capacityHits: Array<{ path: string; value: unknown }>;
  rawSample: unknown;
}

function deepFindCapacity(
  obj: unknown,
  path: string[] = [],
  out: Array<{ path: string; value: unknown }> = [],
  depth = 0,
): Array<{ path: string; value: unknown }> {
  if (depth > 5) return out;
  if (obj === null || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    obj.slice(0, 3).forEach((item, i) => deepFindCapacity(item, [...path, String(i)], out, depth + 1));
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (lower.includes('capacit') || lower.includes('limit') || lower.includes('spot') || lower.includes('max_guest') || lower === 'guest_count' || lower === 'guest_count_max' || lower.includes('attendee')) {
      out.push({ path: [...path, k].join('.'), value: v });
    }
    if (v && typeof v === 'object') deepFindCapacity(v, [...path, k], out, depth + 1);
  }
  return out;
}

async function probeOne(url: string, cookie: string): Promise<ProbeResult> {
  const res = await fetch(url, { headers: { ...BASE_HEADERS, Cookie: cookie }, cache: 'no-store' });
  let body: unknown = null;
  try { body = await res.json(); } catch { body = null; }
  const bodyKeys = body && typeof body === 'object' && !Array.isArray(body)
    ? Object.keys(body as Record<string, unknown>)
    : null;
  return {
    url,
    status: res.status,
    ok: res.ok,
    bodyKeys,
    capacityHits: body ? deepFindCapacity(body) : [],
    rawSample: body,
  };
}

async function main() {
  const eventApiIdArg = process.argv[2];
  const event = eventApiIdArg
    ? { event_api_id: eventApiIdArg, name: '(from CLI arg)', start_at: null }
    : await pickUpcomingEvent();

  console.log(`\n=== Probing event: ${event.name} ===`);
  console.log(`event_api_id: ${event.event_api_id}`);
  console.log(`start_at:    ${event.start_at ?? '—'}\n`);

  const cookie = await getLumaCookie();
  console.log(`Cookie length: ${cookie.length} chars\n`);

  for (const buildUrl of ENDPOINTS) {
    const url = buildUrl(event.event_api_id);
    process.stdout.write(`-> ${url.replace('https://api2.luma.com', '')}  ... `);
    let result: ProbeResult;
    try {
      result = await probeOne(url, cookie);
    } catch (err) {
      console.log(`FAIL: ${(err as Error).message}`);
      continue;
    }
    console.log(`HTTP ${result.status}${result.ok ? ' OK' : ''}`);
    if (result.bodyKeys) {
      console.log(`   top keys: [${result.bodyKeys.join(', ')}]`);
    }
    if (result.capacityHits.length > 0) {
      console.log(`   capacity-related fields:`);
      for (const hit of result.capacityHits) {
        console.log(`     ${hit.path} = ${JSON.stringify(hit.value)}`);
      }
    } else if (result.ok) {
      console.log(`   (no capacity-related field name found — dumping first event keys for inspection)`);
      const inner = (result.rawSample as Record<string, unknown> | null)?.event;
      if (inner && typeof inner === 'object') {
        console.log(`   event keys: [${Object.keys(inner as Record<string, unknown>).join(', ')}]`);
      }
    }
    if (result.ok) break;
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
