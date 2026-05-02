/**
 * Dry-run for the approve-cutoff feature. Lists every future-or-recent event
 * with: start_at (GMT+8), cutoffAt (GMT+8), already past cutoff, and how many
 * waitlist + pending_approval guests would flip to declined:cutoff_* on the
 * very next sync after deploy.
 *
 * Read-only: no Luma writes, no DB writes. Validates impact before deploy.
 *
 * Usage:  npx tsx scripts/dry-run-luma-cutoff.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { getCutoffAt, isPastCutoff } from '../lib/lumaCutoff';

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

function fmtGmt8(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const wall = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const y = wall.getUTCFullYear();
  const m = String(wall.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wall.getUTCDate()).padStart(2, '0');
  const h = String(wall.getUTCHours()).padStart(2, '0');
  const mi = String(wall.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${dd} ${h}:${mi}`;
}

function bucket(eventStartAt: string): 'morning' | 'afternoon' | 'evening' {
  const wall = new Date(new Date(eventStartAt).getTime() + 8 * 60 * 60 * 1000);
  const hour = wall.getUTCHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

async function main() {
  const now = new Date();
  // Look at events from 24h ago through far future. Past events that already
  // ended are uninteresting (sync is a no-op there) but events still in
  // progress / just-past-start matter for the cutoff math.
  const cutoffWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error: evErr } = await supabase
    .from('luma_events')
    .select('event_api_id, name, start_at, end_at, capacity')
    .gte('start_at', cutoffWindowStart)
    .order('start_at', { ascending: true });

  if (evErr) throw evErr;
  if (!events || events.length === 0) {
    console.log('No events in window.');
    return;
  }

  let totalDeclineEligible = 0;
  let totalDeclineWaitlist = 0;
  let totalDeclinePending = 0;
  let pastCutoffEventCount = 0;

  console.log(
    `\n${'event'.padEnd(28)}  ${'start (GMT+8)'.padEnd(17)}  ${'cutoff (GMT+8)'.padEnd(17)}  past?  bucket    cap   wl  pa  declAtSync`,
  );
  console.log('-'.repeat(120));

  for (const ev of events) {
    if (!ev.start_at) continue;
    const cutoffAt = getCutoffAt(ev.start_at);
    const past = isPastCutoff(ev.start_at, now);
    const buck = bucket(ev.start_at);

    const { count: wlCount } = await supabase
      .from('luma_guests')
      .select('id', { count: 'exact', head: true })
      .eq('event_api_id', ev.event_api_id)
      .eq('activity_status', 'waitlist');

    const { count: paCount } = await supabase
      .from('luma_guests')
      .select('id', { count: 'exact', head: true })
      .eq('event_api_id', ev.event_api_id)
      .eq('activity_status', 'pending_approval');

    const wl = wlCount ?? 0;
    const pa = paCount ?? 0;
    const declAtSync = past ? wl + pa : 0;

    if (past) {
      pastCutoffEventCount += 1;
      totalDeclineWaitlist += wl;
      totalDeclinePending += pa;
      totalDeclineEligible += declAtSync;
    }

    const evName = (ev.name ?? ev.event_api_id).slice(0, 28).padEnd(28);
    console.log(
      `${evName}  ${fmtGmt8(ev.start_at).padEnd(17)}  ${fmtGmt8(cutoffAt).padEnd(17)}  ${past ? 'YES  ' : 'no   '}  ${buck.padEnd(9)} ${String(ev.capacity ?? '∞').padStart(4)}  ${String(wl).padStart(3)} ${String(pa).padStart(3)}  ${String(declAtSync).padStart(10)}`,
    );
  }

  console.log('-'.repeat(120));
  console.log(`\nSummary:`);
  console.log(`  Events in window:            ${events.length}`);
  console.log(`  Past cutoff:                 ${pastCutoffEventCount}`);
  console.log(`  Would decline (waitlist):    ${totalDeclineWaitlist}`);
  console.log(`  Would decline (pending):     ${totalDeclinePending}`);
  console.log(`  Total decline at first sync: ${totalDeclineEligible}`);
  console.log('');
  console.log(`(now = ${fmtGmt8(now)} GMT+8)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
