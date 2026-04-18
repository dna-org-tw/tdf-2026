import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getStayWeeksByCodes } from '@/lib/stayQueries';
import { isStayBookable } from '@/lib/stayTime';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const codes: string[] = Array.isArray(body.weekCodes) ? body.weekCodes : [];
  if (codes.length === 0) return NextResponse.json({ error: 'no_weeks' }, { status: 400 });

  const weeks = await getStayWeeksByCodes(codes);
  if (weeks.length !== codes.length) return NextResponse.json({ error: 'week_not_found' }, { status: 404 });

  const items = weeks.map((w) => ({
    code: w.code,
    starts_on: w.starts_on,
    ends_on: w.ends_on,
    price_twd: w.price_twd,
    booking_open: w.status === 'active' && isStayBookable(w.starts_on),
  }));
  const total_twd = items.reduce((sum, w) => sum + w.price_twd, 0);

  return NextResponse.json({ items, total_twd });
}
