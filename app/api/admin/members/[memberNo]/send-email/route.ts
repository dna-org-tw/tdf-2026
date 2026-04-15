import { NextRequest, NextResponse } from 'next/server';
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { getAdminSession } from '@/lib/adminAuth';
import { resolveMember } from '@/lib/adminMembers';
import { logEmail } from '@/lib/emailLog';
import {
  buildComplianceFooterHtml,
  buildComplianceFooterText,
  buildMailgunComplianceOptions,
} from '@/lib/emailCompliance';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const fromRaw = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;
const fromEmail = fromRaw.includes('<') ? fromRaw : `Taiwan Digital Fest <${fromRaw}>`;

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({ username: 'api', key: mailgunApiKey })
  : null;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ memberNo: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { memberNo } = await ctx.params;
  const member = await resolveMember(memberNo);
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const subject = String(body.subject || '').trim();
  const text = String(body.body || '').trim();
  if (!subject || !text) return NextResponse.json({ error: 'subject and body required' }, { status: 400 });

  if (!mailgunClient || !mailgunDomain) {
    return NextResponse.json({ error: 'Mailgun not configured' }, { status: 500 });
  }

  const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>');
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1E1F1C;padding:30px;border-radius:8px;margin-bottom:20px;">
    <h1 style="color:#10B8D9;margin:0;font-size:24px;">Taiwan Digital Fest 2026</h1>
  </div>
  <div style="background:#f9f9f9;padding:30px;border-radius:8px;">
    <h2 style="color:#10B8D9;margin-top:0;">${escapeHtml(subject)}</h2>
    <div style="color:#333;font-size:16px;">${bodyHtml}</div>
  </div>
  ${buildComplianceFooterHtml({ email: member.email })}
</body></html>`;
  const plain = `${text}\n\n${buildComplianceFooterText({ email: member.email })}`;

  try {
    const response = await mailgunClient.messages.create(mailgunDomain, {
      from: fromEmail,
      to: [member.email],
      subject,
      html,
      text: plain,
      ...buildMailgunComplianceOptions({ unsubscribeEmail: member.email, tag: 'admin_one_off' }),
    });

    await logEmail({
      to_email: member.email,
      from_email: fromEmail,
      subject,
      email_type: 'admin_one_off',
      status: 'sent',
      mailgun_message_id: response.id || undefined,
      metadata: { sent_by: session.email, member_no: member.member_no },
    }).catch(() => {});

    return NextResponse.json({ ok: true, messageId: response.id });
  } catch (err) {
    const mg = err as { status?: number; message?: string; details?: string };
    const errMsg = [mg.status ? `HTTP ${mg.status}` : '', mg.message, mg.details].filter(Boolean).join(' — ');
    await logEmail({
      to_email: member.email,
      from_email: fromEmail,
      subject,
      email_type: 'admin_one_off',
      status: 'failed',
      error_message: errMsg,
      metadata: { sent_by: session.email, member_no: member.member_no },
    }).catch(() => {});
    console.error('[Admin Send Email]', err);
    return NextResponse.json({ error: errMsg || 'send failed' }, { status: 500 });
  }
}
