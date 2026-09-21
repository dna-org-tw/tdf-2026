import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { acceptStayTransfer } from '@/lib/stayTransfer';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const result = await acceptStayTransfer({
      transferId: id,
      recipientEmail: session.email,
      setupIntentId: body.setupIntentId ?? null,
    });
    return NextResponse.json({ transfer: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'accept_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
