import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { logEmail } from '@/lib/emailLog';
import { checkRateLimit } from '@/lib/rateLimit';
import { getSessionFromRequest } from '@/lib/auth';
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

    const session = await getSessionFromRequest(req);
    if (!session?.email || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.newEmail) {
      return NextResponse.json({ error: 'New email is required' }, { status: 400 });
    }

    const newEmail = String(body.newEmail).trim().toLowerCase();
    if (!EMAIL_REGEX.test(newEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (newEmail === session.email.trim().toLowerCase()) {
      return NextResponse.json({ error: 'New email is the same as current' }, { status: 400 });
    }

    // Rate limit per session
    const rl = await checkRateLimit(`email-change:user:${session.userId}`, { limit: 5, windowSeconds: 60 * 60 });
    if (!rl.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: 'rate_limited', retryAfter: retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      );
    }

    // Reject if newEmail is already a registered user (collision)
    const { data: existingUser, error: userErr } = await supabaseServer
      .from('users')
      .select('id')
      .eq('email', newEmail)
      .maybeSingle();
    if (userErr) throw userErr;
    if (existingUser) {
      return NextResponse.json({ error: 'email_in_use' }, { status: 409 });
    }

    // Reject if newEmail is already a known member identity (would collide on members.email unique)
    const { data: existingMember, error: mErr } = await supabaseServer
      .from('members')
      .select('id')
      .eq('email', newEmail)
      .maybeSingle();
    if (mErr) throw mErr;
    if (existingMember) {
      return NextResponse.json({ error: 'email_in_use' }, { status: 409 });
    }

    // Invalidate previous unused change codes for this destination email
    await supabaseServer
      .from('auth_tokens')
      .update({ used: true })
      .eq('email', newEmail)
      .eq('used', false);

    const code = generateCode();
    const tokenHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error: tokenErr } = await supabaseServer
      .from('auth_tokens')
      .insert({ email: newEmail, token_hash: tokenHash, expires_at: expiresAt });
    if (tokenErr) {
      console.error('[Email Change] failed to store token', tokenErr);
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    const subject = 'Confirm your new email / 確認您的新電子郵件 — Taiwan Digital Fest 2026';
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 24px;">Taiwan Digital Fest 2026</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #10B8D9; margin-top: 0;">Confirm Email Change / 確認變更電子郵件</h2>
    <p>You requested to change your account email to <strong>${newEmail}</strong>. Enter this code in the website to confirm. It expires in ${CODE_EXPIRY_MINUTES} minutes.</p>
    <p>您要求將帳號電子郵件變更為 <strong>${newEmail}</strong>。在網站上輸入下方驗證碼以確認，${CODE_EXPIRY_MINUTES} 分鐘後失效。</p>
    <div style="text-align: center; margin: 30px 0;">
      <span style="display: inline-block; background-color: #1E1F1C; color: #10B8D9; padding: 16px 32px; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">${code}</span>
    </div>
    <p style="color: #666; font-size: 14px;">If you didn't request this change, you can safely ignore this email — your account stays as <strong>${session.email}</strong>.<br>如果您並未要求變更，可以忽略此郵件，您的帳號仍會維持為 <strong>${session.email}</strong>。</p>
  </div>
  <div style="text-align: center; color: #999; font-size: 12px;"><p>This is an automated email. Please do not reply.</p></div>
</body></html>`;

    const textContent = `Taiwan Digital Fest 2026 - Confirm Email Change

You requested to change your account email to ${newEmail}.
Confirmation code: ${code}
Expires in ${CODE_EXPIRY_MINUTES} minutes.

If you didn't request this, you can ignore — your account stays as ${session.email}.`;

    const response = await mailgunClient.messages.create(mailgunDomain, {
      from: fromEmail,
      to: newEmail,
      subject,
      html: htmlContent,
      text: textContent,
    });

    if (!response?.id) {
      logEmail({
        to_email: newEmail, from_email: fromEmail, subject,
        email_type: 'magic_link', status: 'failed',
        error_message: 'Mailgun returned no message ID',
        metadata: { type: 'email_change', current_email: session.email },
      }).catch(() => {});
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    logEmail({
      to_email: newEmail, from_email: fromEmail, subject,
      email_type: 'magic_link', status: 'sent',
      mailgun_message_id: response.id,
      metadata: { type: 'email_change', current_email: session.email },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[Email Change Request] Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
