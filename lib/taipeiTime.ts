/**
 * Get the start of "today" and "tomorrow" in Taipei time (UTC+8),
 * returned as UTC Date objects suitable for Supabase queries.
 */
export function getTaipeiDayBounds(): { todayStart: Date; tomorrowStart: Date } {
  const now = new Date();
  const taipeiOffset = 8 * 60; // UTC+8 in minutes
  // Shift now to Taipei local time (as if UTC)
  const taipeiNow = new Date(now.getTime() + (taipeiOffset + now.getTimezoneOffset()) * 60 * 1000);
  // Start of day in Taipei, converted back to UTC
  const todayStart = new Date(
    Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate()) -
      taipeiOffset * 60 * 1000
  );
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  return { todayStart, tomorrowStart };
}
