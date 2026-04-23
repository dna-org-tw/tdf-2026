export function getStayBookingDeadlineAt(startsOn: string): Date {
  const [y, m, d] = startsOn.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 8, 15, 59, 59, 999));
}

export function isStayBookable(startsOn: string, now = new Date()): boolean {
  return now.getTime() <= getStayBookingDeadlineAt(startsOn).getTime();
}

/**
 * Cutoff date (YYYY-MM-DD) in Taipei local time. The deadline is constructed
 * at 15:59:59 UTC which is 23:59:59 Taipei on the same calendar date, so
 * extracting the UTC date portion yields the correct Taipei date.
 */
export function getStayBookingDeadlineDate(startsOn: string): string {
  return getStayBookingDeadlineAt(startsOn).toISOString().slice(0, 10);
}
