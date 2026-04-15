// app/api/auth/send-code/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { logEmail } from '@/lib/emailLog';
import { checkRateLimit } from '@/lib/rateLimit';
import { createHash, randomInt } from 'crypto';
import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const fromRaw = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;
const fromEmail = fromRaw.includes('<') ? fromRaw : `Taiwan Digital Fest <${fromRaw}>`;

const CODE_EXPIRY_MINUTES = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({ username: 'api', key: mailgunApiKey })
  : null;

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    if (!mailgunClient || !mailgunDomain) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipLimit = await checkRateLimit(`send-code:ip:${ip}`, { limit: 5, windowSeconds: 15 * 60 });
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const emailLimit = await checkRateLimit(`send-code:email:${email}`, { limit: 3, windowSeconds: 15 * 60 });
    if (!emailLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests for this email' }, { status: 429 });
    }

    // Upsert user
    const { error: userError } = await supabaseServer
      .from('users')
      .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
    if (userError) {
      console.error('[Auth] Failed to upsert user:', userError);
      return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }

    // Invalidate previous unused tokens for this email
    await supabaseServer
      .from('auth_tokens')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);

    // Clean up old tokens (fire and forget)
    const cleanupThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    supabaseServer
      .from('auth_tokens')
      .delete()
      .eq('used', true)
      .lt('created_at', cleanupThreshold)
      .then(({ error }) => {
        if (error) console.error('[Auth] Token cleanup error:', error);
      });

    // Generate 6-digit code
    const code = generateCode();
    const tokenHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error: tokenError } = await supabaseServer
      .from('auth_tokens')
      .insert({ email, token_hash: tokenHash, expires_at: expiresAt });
    if (tokenError) {
      console.error('[Auth] Failed to store token:', tokenError);
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    // Send email. Login codes are transactional: they must reach the user
    // even if they previously unsubscribed from marketing mail. We do NOT
    // check email_suppressions here on purpose — the user is actively trying
    // to sign in to their own account.
    const subject = 'Your Login Code / 您的登入驗證碼 — Taiwan Digital Fest 2026';
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 24px;">Taiwan Digital Fest 2026</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #10B8D9; margin-top: 0;">Login Code / 登入驗證碼</h2>
    <p>Enter this code on the website to sign in. It expires in ${CODE_EXPIRY_MINUTES} minutes.</p>
    <p>在網站上輸入此驗證碼以登入。驗證碼將在 ${CODE_EXPIRY_MINUTES} 分鐘後失效。</p>
    <div style="text-align: center; margin: 30px 0;">
      <span style="display: inline-block; background-color: #1E1F1C; color: #10B8D9; padding: 16px 32px; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">${code}</span>
    </div>
    <p style="color: #666; font-size: 14px;">
      If you didn't request this code, you can safely ignore this email.<br>
      如果您未要求此驗證碼，可以安全地忽略此郵件。
    </p>
  </div>
  <div style="text-align: center; color: #999; font-size: 12px;">
    <p>This is an automated email. Please do not reply.</p>
  </div>
</body>
</html>`;

    const textContent = `Taiwan Digital Fest 2026 - Login Code

Your login code: ${code}

Enter this code on the website to sign in. It expires in ${CODE_EXPIRY_MINUTES} minutes.
在網站上輸入此驗證碼以登入。驗證碼將在 ${CODE_EXPIRY_MINUTES} 分鐘後失效。

If you didn't request this code, you can safely ignore this email.
如果您未要求此驗證碼，可以安全地忽略此郵件。`;

    const response = await mailgunClient.messages.create(mailgunDomain, {
      from: fromEmail,
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
    });

    if (!response?.id) {
      logEmail({
        to_email: email, from_email: fromEmail, subject,
        email_type: 'magic_link', status: 'failed',
        error_message: 'Mailgun returned no message ID',
        metadata: { type: 'login_code' },
      }).catch(() => {});
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    logEmail({
      to_email: email, from_email: fromEmail, subject,
      email_type: 'magic_link', status: 'sent',
      mailgun_message_id: response.id,
      metadata: { type: 'login_code' },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Auth] Error in send-code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
