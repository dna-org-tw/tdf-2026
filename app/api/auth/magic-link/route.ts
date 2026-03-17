import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { logEmail } from '@/lib/emailLog';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const fromEmail = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({ username: 'api', key: mailgunApiKey })
  : null;

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    if (!mailgunClient || !mailgunDomain) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();

    // Generate magic link using Supabase Admin API (does not send email)
    const { data, error } = await supabaseServer.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (error || !data?.properties?.hashed_token) {
      console.error('[Auth] Failed to generate magic link:', error);
      return NextResponse.json({ error: 'Failed to generate login link' }, { status: 500 });
    }

    const tokenHash = data.properties.hashed_token;
    const callbackUrl = `${baseUrl}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;

    const subject = 'Sign in to Taiwan Digital Fest 2026';
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 24px;">Taiwan Digital Fest 2026</h1>
  </div>

  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #10B8D9; margin-top: 0;">Sign In / 登入</h2>

    <p>Click the button below to sign in to your account. This link will expire in 1 hour.</p>
    <p>點擊下方按鈕登入您的帳戶。此連結將在 1 小時後失效。</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${callbackUrl}"
         style="display: inline-block; background-color: #10B8D9; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Sign In / 登入
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">
      If you didn't request this email, you can safely ignore it.<br>
      如果您未要求此郵件，可以安全地忽略它。
    </p>

    <p style="color: #999; font-size: 12px; word-break: break-all;">
      Or copy and paste this link: ${callbackUrl}
    </p>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    <p>This is an automated email. Please do not reply to this message.</p>
  </div>
</body>
</html>`;

    const textContent = `Taiwan Digital Fest 2026 - Sign In

Click the link below to sign in to your account. This link will expire in 1 hour.
點擊下方連結登入您的帳戶。此連結將在 1 小時後失效。

${callbackUrl}

If you didn't request this email, you can safely ignore it.
如果您未要求此郵件，可以安全地忽略它。`;

    const response = await mailgunClient.messages.create(mailgunDomain, {
      from: fromEmail,
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
    });

    if (!response?.id) {
      logEmail({
        to_email: email,
        from_email: fromEmail,
        subject,
        email_type: 'magic_link',
        status: 'failed',
        error_message: 'Mailgun returned no message ID',
        metadata: { type: 'magic_link' },
      }).catch(() => {});
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    logEmail({
      to_email: email,
      from_email: fromEmail,
      subject,
      email_type: 'magic_link',
      status: 'sent',
      mailgun_message_id: response.id,
      metadata: { type: 'magic_link' },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Auth] Error in magic-link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
