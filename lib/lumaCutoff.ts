import type { ReviewDecision } from '@/lib/lumaAutoReview';

// Approve cutoff (GMT+8): once `now >= cutoffAt(start_at)`, sync stops
// promoting guests to approved. Existing approveds keep their seat; everything
// else collapses to declined:cutoff_*. Three fixed wall-clock cutoffs map to
// three time-of-day buckets of the event's start_at:
//   morning   [00:00, 12:00) → same day 00:00
//   afternoon [12:00, 18:00) → same day 06:00
//   evening   [18:00, 24:00) → same day 12:00
// Taiwan does not observe DST, so a fixed +8h offset is exact.

const TZ_OFFSET_HOURS = 8;
const TZ_OFFSET_MS = TZ_OFFSET_HOURS * 60 * 60 * 1000;

export function getCutoffAt(eventStartAt: string): Date {
  const startUtcMs = new Date(eventStartAt).getTime();
  // Shift into GMT+8 wall clock: getUTC* on `wall` now reads as Asia/Taipei.
  const wall = new Date(startUtcMs + TZ_OFFSET_MS);
  const hour = wall.getUTCHours();
  const y = wall.getUTCFullYear();
  const m = wall.getUTCMonth();
  const d = wall.getUTCDate();

  let cutoffWallMs: number;
  if (hour < 12) {
    cutoffWallMs = Date.UTC(y, m, d, 0, 0, 0);
  } else if (hour < 18) {
    cutoffWallMs = Date.UTC(y, m, d, 6, 0, 0);
  } else {
    cutoffWallMs = Date.UTC(y, m, d, 12, 0, 0);
  }
  return new Date(cutoffWallMs - TZ_OFFSET_MS);
}

export function isPastCutoff(eventStartAt: string, now: Date): boolean {
  return now.getTime() >= getCutoffAt(eventStartAt).getTime();
}

export function applyCutoffOverride(
  decision: ReviewDecision,
  currentStatus: string | null,
): ReviewDecision {
  if (decision.status === 'approved') {
    // Already approved → keep seat; ticket-type changes (downgrade) still flow.
    if (currentStatus === 'approved') return decision;
    return { status: 'declined', reason: 'declined:cutoff_eligible' };
  }
  if (decision.status === 'waitlist') {
    const tail = decision.reason.startsWith('waitlist:')
      ? decision.reason.slice('waitlist:'.length)
      : decision.reason;
    return { status: 'declined', reason: `declined:cutoff_${tail}` };
  }
  return decision;
}
