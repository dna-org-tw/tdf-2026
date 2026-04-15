import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { logEmail } from '@/lib/emailLog';
import { checkRateLimit } from '@/lib/rateLimit';
import { createHash, randomBytes } from 'crypto';
import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const fromRaw = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;
const fromEmail = fromRaw.includes('<') ? fromRaw : `Taiwan Digital Fest <${fromRaw}>`;

const TOKEN_EXPIRY_MINUTES = 60; // 1 hour
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    // Rate limit by IP: 5 requests per 15 minutes
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipLimit = await checkRateLimit(`magic-link:ip:${ip}`, { limit: 5, windowSeconds: 15 * 60 });
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Rate limit by email: 3 requests per 15 minutes
    const emailLimit = await checkRateLimit(`magic-link:email:${email}`, { limit: 3, windowSeconds: 15 * 60 });
    if (!emailLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests for this email. Please try again later.' }, { status: 429 });
    }

    // Upsert user record
    const { error: userError } = await supabaseServer
      .from('users')
      .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });

    if (userError) {
      console.error('[Auth] Failed to upsert user:', userError);
      return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }

    // Invalidate any existing unused tokens for this email
    await supabaseServer
      .from('auth_tokens')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);

    // Clean up expired/used tokens older than 24 hours (prevent DB bloat)
    const cleanupThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    supabaseServer
      .from('auth_tokens')
      .delete()
      .eq('used', true)
      .lt('created_at', cleanupThreshold)
      .then(({ error }) => {
        if (error) console.error('[Auth] Token cleanup error:', error);
      });

    // Generate a secure random token
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Store token hash in DB
    const { error: tokenError } = await supabaseServer
      .from('auth_tokens')
      .insert({ email, token_hash: tokenHash, expires_at: expiresAt });

    if (tokenError) {
      console.error('[Auth] Failed to store token:', tokenError);
      return NextResponse.json({ error: 'Failed to generate login link' }, { status: 500 });
    }

    const callbackUrl = `${baseUrl}/api/auth/verify?token=${token}`;

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

    <p>Click the button below to sign in to your account. This link will expire in ${TOKEN_EXPIRY_MINUTES} minutes.</p>
    <p>點擊下方按鈕登入您的帳戶。此連結將在 ${TOKEN_EXPIRY_MINUTES} 分鐘後失效。</p>

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

Click the link below to sign in to your account. This link will expire in ${TOKEN_EXPIRY_MINUTES} minutes.
點擊下方連結登入您的帳戶。此連結將在 ${TOKEN_EXPIRY_MINUTES} 分鐘後失效。

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
