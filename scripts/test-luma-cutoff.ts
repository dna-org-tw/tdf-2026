/**
 * Standalone tests for lib/lumaCutoff.ts. No test framework; uses node:assert.
 *
 * Run:  npx tsx scripts/test-luma-cutoff.ts
 *
 * Cases mirror docs/superpowers/specs/2026-05-02-luma-approve-cutoff-design.md
 * (the table in §"Decision rewrite table" and the §"Boundary" notes).
 */

import { strict as assert } from 'node:assert';
import { getCutoffAt, isPastCutoff, applyCutoffOverride } from '../lib/lumaCutoff';
import type { ReviewDecision } from '../lib/lumaAutoReview';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${(err as Error).message}`);
  }
}

function iso(gmt8: string): string {
  // gmt8 like '2026-05-10T01:00:00' (treated as GMT+8) → UTC ISO
  const m = gmt8.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`bad gmt8 input: ${gmt8}`);
  const [, y, mo, d, h, mi, s] = m;
  const wallMs = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  return new Date(wallMs - 8 * 60 * 60 * 1000).toISOString();
}

console.log('getCutoffAt');

test('morning 01:00 → previous day 00:00', () => {
  const start = iso('2026-05-10T01:00:00');
  const cutoff = getCutoffAt(start);
  assert.equal(cutoff.toISOString(), iso('2026-05-09T00:00:00'));
});

test('morning 11:59 → previous day 00:00', () => {
  const start = iso('2026-05-10T11:59:00');
  const cutoff = getCutoffAt(start);
  assert.equal(cutoff.toISOString(), iso('2026-05-09T00:00:00'));
});

test('afternoon 12:00 → same day 06:00', () => {
  const start = iso('2026-05-10T12:00:00');
  const cutoff = getCutoffAt(start);
  assert.equal(cutoff.toISOString(), iso('2026-05-10T06:00:00'));
});

test('afternoon 17:59 → same day 06:00', () => {
  const start = iso('2026-05-10T17:59:00');
  const cutoff = getCutoffAt(start);
  assert.equal(cutoff.toISOString(), iso('2026-05-10T06:00:00'));
});

test('evening 18:00 → same day 12:00', () => {
  const start = iso('2026-05-10T18:00:00');
  const cutoff = getCutoffAt(start);
  assert.equal(cutoff.toISOString(), iso('2026-05-10T12:00:00'));
});

test('evening 23:59 → same day 12:00', () => {
  const start = iso('2026-05-10T23:59:00');
  const cutoff = getCutoffAt(start);
  assert.equal(cutoff.toISOString(), iso('2026-05-10T12:00:00'));
});

test('morning 00:00 boundary → previous day 00:00', () => {
  const start = iso('2026-05-10T00:00:00');
  const cutoff = getCutoffAt(start);
  assert.equal(cutoff.toISOString(), iso('2026-05-09T00:00:00'));
});

test('month rollover: morning 01:00 on 1st → previous month last day 00:00', () => {
  const start = iso('2026-06-01T01:00:00');
  const cutoff = getCutoffAt(start);
  assert.equal(cutoff.toISOString(), iso('2026-05-31T00:00:00'));
});

console.log('isPastCutoff');

test('exactly at cutoff (00:00:00) is past', () => {
  const start = iso('2026-05-10T01:00:00'); // morning → cutoff = 2026-05-09T00:00 GMT+8
  const now = new Date(iso('2026-05-09T00:00:00'));
  assert.equal(isPastCutoff(start, now), true);
});

test('one second before cutoff is not past', () => {
  const start = iso('2026-05-10T01:00:00');
  const cutoffMs = new Date(iso('2026-05-09T00:00:00')).getTime();
  const now = new Date(cutoffMs - 1000);
  assert.equal(isPastCutoff(start, now), false);
});

test('one second after cutoff is past', () => {
  const start = iso('2026-05-10T01:00:00');
  const cutoffMs = new Date(iso('2026-05-09T00:00:00')).getTime();
  const now = new Date(cutoffMs + 1000);
  assert.equal(isPastCutoff(start, now), true);
});

console.log('applyCutoffOverride');

const dec = (status: ReviewDecision['status'], reason: string, extra?: Partial<ReviewDecision>): ReviewDecision => ({
  status,
  reason,
  ...extra,
});

test('approved:eligible + currentStatus=approved → keep approved', () => {
  const out = applyCutoffOverride(dec('approved', 'approved:eligible'), 'approved');
  assert.equal(out.status, 'approved');
  assert.equal(out.reason, 'approved:eligible');
});

test('approved:eligible + currentStatus=waitlist → declined:cutoff_eligible', () => {
  const out = applyCutoffOverride(dec('approved', 'approved:eligible'), 'waitlist');
  assert.equal(out.status, 'declined');
  assert.equal(out.reason, 'declined:cutoff_eligible');
});

test('approved:upgraded + currentStatus=pending_approval → declined:cutoff_eligible', () => {
  const out = applyCutoffOverride(dec('approved', 'approved:upgraded'), 'pending_approval');
  assert.equal(out.status, 'declined');
  assert.equal(out.reason, 'declined:cutoff_eligible');
});

test('approved:upgraded + currentStatus=null → declined:cutoff_eligible', () => {
  const out = applyCutoffOverride(dec('approved', 'approved:upgraded'), null);
  assert.equal(out.status, 'declined');
  assert.equal(out.reason, 'declined:cutoff_eligible');
});

test('approved:downgraded + currentStatus=approved → keep (preserves ticket change)', () => {
  const out = applyCutoffOverride(
    dec('approved', 'approved:downgraded', { targetTicketTypeApiId: 'tt-x' }),
    'approved',
  );
  assert.equal(out.status, 'approved');
  assert.equal(out.targetTicketTypeApiId, 'tt-x');
});

test('approved:downgraded + currentStatus=waitlist → declined:cutoff_eligible', () => {
  const out = applyCutoffOverride(dec('approved', 'approved:downgraded'), 'waitlist');
  assert.equal(out.status, 'declined');
  assert.equal(out.reason, 'declined:cutoff_eligible');
});

test('waitlist:no_membership → declined:cutoff_no_membership', () => {
  const out = applyCutoffOverride(dec('waitlist', 'waitlist:no_membership'), 'pending_approval');
  assert.equal(out.status, 'declined');
  assert.equal(out.reason, 'declined:cutoff_no_membership');
});

test('waitlist:tier_mismatch → declined:cutoff_tier_mismatch', () => {
  const out = applyCutoffOverride(dec('waitlist', 'waitlist:tier_mismatch'), 'approved');
  assert.equal(out.status, 'declined');
  assert.equal(out.reason, 'declined:cutoff_tier_mismatch');
});

test('waitlist:non_tdf_ticket → declined:cutoff_non_tdf_ticket', () => {
  const out = applyCutoffOverride(dec('waitlist', 'waitlist:non_tdf_ticket'), 'pending_approval');
  assert.equal(out.status, 'declined');
  assert.equal(out.reason, 'declined:cutoff_non_tdf_ticket');
});

test('waitlist:no_show_penalty → declined:cutoff_no_show_penalty', () => {
  const out = applyCutoffOverride(
    dec('waitlist', 'waitlist:no_show_penalty', { consumedNoShowEventApiId: 'evt-y' }),
    'waitlist',
  );
  assert.equal(out.status, 'declined');
  assert.equal(out.reason, 'declined:cutoff_no_show_penalty');
});

test('waitlist:weekly_out_of_range → declined:cutoff_weekly_out_of_range', () => {
  const out = applyCutoffOverride(dec('waitlist', 'waitlist:weekly_out_of_range'), 'approved');
  assert.equal(out.status, 'declined');
  assert.equal(out.reason, 'declined:cutoff_weekly_out_of_range');
});

test('waitlist:capacity_full → declined:cutoff_capacity_full', () => {
  const out = applyCutoffOverride(dec('waitlist', 'waitlist:capacity_full'), 'pending_approval');
  assert.equal(out.status, 'declined');
  assert.equal(out.reason, 'declined:cutoff_capacity_full');
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
