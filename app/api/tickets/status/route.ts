// app/api/tickets/status/route.ts
import { NextResponse } from 'next/server';
import { getTicketSaleCutoff } from '@/lib/ticketSaleCutoff';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cutoff = await getTicketSaleCutoff();
  const closed = Date.now() >= cutoff.getTime();
  return NextResponse.json(
    {
      closed,
      cutoff: cutoff.toISOString(),
      supportEmail: 'registration@taiwandigitalfest.com',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
