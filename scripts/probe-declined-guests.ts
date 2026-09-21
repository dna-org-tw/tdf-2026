/**
 * Probe Luma's raw guest data for currently-declined entries to determine
 * whether `approval_status='declined'` represents a self-cancellation,
 * an admin decline, or something else — and whether the auto-review would
 * incorrectly re-approve them.
 *
 * One-shot diagnostic; safe to delete after issue is resolved.
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

async function main() {
  const { fetchEventGuests } = await import('../lib/lumaApi');

  const { data } = await sb
    .from('luma_guests')
    .select('event_api_id, email, activity_status, luma_events(name)')
    .eq('activity_status', 'declined')
    .limit(10);

  const cookie = await getCookie();

  if (!data || data.length === 0) {
    console.log('No declined rows currently in luma_guests.');
    return;
  }

  for (const row of data) {
    const eventName = (row.luma_events as { name?: string } | null)?.name ?? row.event_api_id;
    console.log(`\n=== ${eventName} ===`);
    console.log(`   email: ${row.email}`);
    let guests;
    try {
      guests = await fetchEventGuests(row.event_api_id, cookie);
    } catch (e) {
      console.log(`   ⚠️  Luma fetch failed: ${(e as Error).message}`);
      continue;
    }
    const g = guests.find(
      (x) => (x.email ?? '').toLowerCase() === row.email.toLowerCase(),
    );
    if (!g) {
      console.log(`   ⚠️  NOT FOUND in Luma roster — reverse-sync would delete this row.`);
      continue;
    }
    console.log(`   approval_status:    ${g.approval_status ?? '(none)'}`);
    console.log(`   registration_status: ${g.registration_status ?? '(none)'}`);
    console.log(`   raw keys: [${Object.keys(g).join(', ')}]`);
    for (const [k, v] of Object.entries(g)) {
      if (/cancel|going|decline|opt|response|attend|invite|rsvp/i.test(k)) {
        console.log(`     ${k} = ${JSON.stringify(v)}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
