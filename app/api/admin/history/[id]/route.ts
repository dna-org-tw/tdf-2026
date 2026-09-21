import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { id } = await params;

  try {
    // Fetch notification log
    const { data: notification, error: notifError } = await supabaseServer
      .from('notification_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (notifError || !notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Fetch per-recipient email logs
    const { data: emailLogs, error: logsError } = await supabaseServer
      .from('email_logs')
      .select('id, to_email, status, error_message, mailgun_message_id, created_at')
      .eq('notification_id', id)
      .order('created_at', { ascending: true });

    if (logsError) {
      console.error('[Admin History Detail]', logsError);
    }

    return NextResponse.json({
      notification,
      emailLogs: emailLogs || [],
    });
  } catch (error) {
    console.error('[Admin History Detail]', error);
    return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 });
  }
}
