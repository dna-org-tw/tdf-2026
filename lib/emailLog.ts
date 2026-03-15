import { supabaseServer } from './supabaseServer';

export type EmailType =
  | 'subscription_thank_you'
  | 'vote_confirmation'
  | 'order_success'
  | 'order_cancelled'
  | 'magic_link';

interface EmailLogEntry {
  to_email: string;
  from_email?: string;
  subject?: string;
  email_type: EmailType;
  status: 'sent' | 'failed';
  mailgun_message_id?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export async function logEmail(entry: EmailLogEntry): Promise<void> {
  if (!supabaseServer) {
    console.warn('[EmailLog] Supabase not configured, skipping email log.');
    return;
  }

  try {
    const { error } = await supabaseServer.from('email_logs').insert({
      to_email: entry.to_email,
      from_email: entry.from_email ?? null,
      subject: entry.subject ?? null,
      email_type: entry.email_type,
      status: entry.status,
      mailgun_message_id: entry.mailgun_message_id ?? null,
      error_message: entry.error_message ?? null,
      metadata: entry.metadata ?? null,
    });

    if (error) {
      console.error('[EmailLog] Failed to insert email log:', error);
    }
  } catch (err) {
    console.error('[EmailLog] Unexpected error logging email:', err);
  }
}
