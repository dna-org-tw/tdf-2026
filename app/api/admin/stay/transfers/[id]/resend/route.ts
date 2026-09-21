import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendStayEmail } from '@/lib/stayEmail';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id } = await ctx.params;
  const { data: transfer, error } = await supabaseServer
    .from('stay_transfers')
    .select('*, stay_booking_weeks(stay_weeks(code, starts_on, ends_on))')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!transfer) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (transfer.status !== 'pending_acceptance') {
    return NextResponse.json({ error: 'transfer_not_pending' }, { status: 400 });
  }

  try {
    await sendStayEmail({
      to: transfer.to_email,
      subject: 'Stay transfer request resent',
      html: `<p>You have a pending stay transfer (id: ${transfer.id}). Expires at ${transfer.expires_at}.</p>`,
      text: `You have a pending stay transfer (id: ${transfer.id}). Expires at ${transfer.expires_at}.`,
      emailType: 'stay_transfer_requested',
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'email_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
