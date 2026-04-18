import { supabaseServer } from './supabaseServer';

export type EmailType =
  | 'subscription_thank_you'
  | 'vote_confirmation'
  | 'order_success'
  | 'order_cancelled'
  | 'order_transferred_from'
  | 'order_transferred_to'
  | 'magic_link'
  | 'unsubscribe_confirmation'
  | 'notification'
  | 'admin_one_off'
  | 'stay_booking_confirmed'
  | 'stay_booking_complimentary_confirmed'
  | 'stay_transfer_requested'
  | 'stay_transfer_accepted'
  | 'stay_waitlist_offer'
  | 'stay_waitlist_expired'
  | 'stay_modification_confirmed'
  | 'stay_no_show_charged';

interface EmailLogEntry {
  to_email: string;
  from_email?: string;
  subject?: string;
  email_type: EmailType;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  mailgun_message_id?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
  notification_id?: string;
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
      notification_id: entry.notification_id ?? null,
    });

    if (error) {
      console.error('[EmailLog] Failed to insert email log:', error);
    }
  } catch (err) {
    console.error('[EmailLog] Unexpected error logging email:', err);
  }
}
