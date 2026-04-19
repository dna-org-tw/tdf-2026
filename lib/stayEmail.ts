import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { logEmail } from '@/lib/emailLog';

const mailgunClient = process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN
  ? new Mailgun(formData).client({ username: 'api', key: process.env.MAILGUN_API_KEY })
  : null;

export type StayEmailType =
  | 'stay_booking_confirmed'
  | 'stay_booking_complimentary_confirmed'
  | 'stay_transfer_requested'
  | 'stay_transfer_accepted'
  | 'stay_waitlist_offer'
  | 'stay_waitlist_expired'
  | 'stay_modification_confirmed'
  | 'stay_no_show_charged'
  | 'stay_invite_code';

export async function sendStayEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  emailType: StayEmailType;
}) {
  if (!mailgunClient || !process.env.MAILGUN_DOMAIN) throw new Error('mailgun_not_configured');

  const response = await mailgunClient.messages.create(process.env.MAILGUN_DOMAIN, {
    from: process.env.EMAIL_FROM || `Taiwan Digital Fest <noreply@${process.env.MAILGUN_DOMAIN}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  await logEmail({
    to_email: input.to,
    subject: input.subject,
    email_type: input.emailType,
    status: 'sent',
    mailgun_message_id: response.id ?? undefined,
  });
}
