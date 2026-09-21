import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createStayTransfer } from '@/lib/stayTransfer';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const { bookingWeekId, toEmail } = await req.json();
    const transfer = await createStayTransfer({
      bookingId: id,
      bookingWeekId,
      fromEmail: session.email,
      toEmail,
    });
    return NextResponse.json({ transfer });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'transfer_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
