export function getStayBookingDeadlineAt(startsOn: string): Date {
  const [y, m, d] = startsOn.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 3, 15, 59, 59, 999));
}

export function isStayBookable(startsOn: string, now = new Date()): boolean {
  return now.getTime() <= getStayBookingDeadlineAt(startsOn).getTime();
}
