import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendStayInviteEmail } from '@/lib/stayInviteEmail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id } = await params;

  let email: string;
  try {
    const body = await req.json();
    email = String(body?.email ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const { data: row, error: loadErr } = await supabaseServer
    .from('stay_invite_codes')
    .select('id, code, status')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (row.status !== 'active') return NextResponse.json({ error: 'not_active' }, { status: 409 });

  try {
    await sendStayInviteEmail({ to: email, code: row.code });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send_failed';
    if (message === 'mailgun_not_configured') {
      return NextResponse.json({ error: 'mailgun_not_configured' }, { status: 500 });
    }
    return NextResponse.json({ error: 'send_failed', detail: message }, { status: 502 });
  }

  const { data: updated, error: updateErr } = await supabaseServer
    .from('stay_invite_codes')
    .update({
      sent_to_email: email,
      sent_at: new Date().toISOString(),
      sent_by: session.email,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (updateErr) {
    return NextResponse.json(
      { error: 'persisted_send_failed', detail: updateErr.message, sent: true },
      { status: 500 },
    );
  }

  return NextResponse.json({ code: updated });
}
