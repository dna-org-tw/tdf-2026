import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyUnsubscribeToken, generateUnsubscribeToken } from '@/lib/email';
import { addSuppression } from '@/lib/emailCompliance';
import { sendUnsubscribeConfirmationEmail } from '@/lib/unsubscribeEmail';
import { content } from '@/data/content';
import { verifyRecaptcha } from '@/lib/recaptcha';

/**
 * Soft-unsubscribe: mark newsletter_subscriptions row and insert a row into
 * the global email_suppressions list so that ALL bulk sends (newsletters,
 * notifications) honor the opt-out — not just the newsletter table.
 */
async function applyUnsubscribe(email: string, source: string): Promise<Error | null> {
  if (!supabaseServer) return new Error('Supabase not configured');

  const { error } = await supabaseServer
    .from('newsletter_subscriptions')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('email', email)
    .is('unsubscribed_at', null);

  if (error) return error;

  await addSuppression(email, 'unsubscribed', source);
  return null;
}

// Helper function to get language from request
function getLangFromRequest(req: NextRequest): 'en' | 'zh' {
  const url = new URL(req.url);
  const langParam = url.searchParams.get('lang');
  if (langParam === 'en' || langParam === 'zh') {
    return langParam;
  }
  // Try to get from referer header
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererLang = refererUrl.searchParams.get('lang');
      if (refererLang === 'en' || refererLang === 'zh') {
        return refererLang;
      }
    } catch {
      // Ignore URL parsing errors
    }
  }
  return 'zh'; // Default to Chinese
}

export async function GET(req: NextRequest) {
  const lang = getLangFromRequest(req);
  const t = content[lang].api;
  
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: t.supabaseNotConfigured },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: t.unsubscribeTokenRequired },
        { status: 400 }
      );
    }

    // 驗證 token 並獲取 email
    const email = verifyUnsubscribeToken(token);

    if (!email) {
      return NextResponse.json(
        { error: t.invalidUnsubscribeToken },
        { status: 400 }
      );
    }

    const err = await applyUnsubscribe(email, 'token_link');
    if (err) {
      console.error('[Unsubscribe API] soft-unsubscribe error:', err);
      return NextResponse.json(
        { error: t.unsubscribeFailed },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: t.unsubscribeSuccess },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Unsubscribe API] Unexpected error:', error);
    return NextResponse.json(
      { error: t.unsubscribeFailed },
      { status: 500 }
    );
  }
}

/**
 * RFC 8058 one-click POST (triggered by the `List-Unsubscribe-Post` header).
 * Mail clients like Gmail/Yahoo POST to the List-Unsubscribe URL with
 * `List-Unsubscribe=One-Click` in the body; we accept the token from the URL.
 */

// 簡單的 Email 格式驗證
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(req: NextRequest) {
  const lang = getLangFromRequest(req);
  const t = content[lang].api;

  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: t.supabaseNotConfigured },
        { status: 500 }
      );
    }

    // RFC 8058 one-click path: token in query string, body is form-encoded
    // `List-Unsubscribe=One-Click` from the mail client. Must succeed without
    // requiring JSON or authentication.
    const queryToken = new URL(req.url).searchParams.get('token');
    if (queryToken) {
      const email = verifyUnsubscribeToken(queryToken);
      if (!email) {
        return NextResponse.json(
          { error: t.invalidUnsubscribeToken },
          { status: 400 }
        );
      }
      const err = await applyUnsubscribe(email, 'one_click_post');
      if (err) {
        console.error('[Unsubscribe API] one-click unsubscribe error:', err);
        return NextResponse.json(
          { error: t.unsubscribeFailed },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { success: true, message: t.unsubscribeSuccess },
        { status: 200 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: t.unsubscribeTokenRequired },
        { status: 400 }
      );
    }

    let email: string | null = null;

    if (body.token) {
      // 驗證 token 並獲取 email
      email = verifyUnsubscribeToken(body.token);
      if (!email) {
        return NextResponse.json(
          { error: t.invalidUnsubscribeToken },
          { status: 400 }
        );
      }
    } else if (body.email) {
      // Email provided without token: send confirmation email instead of directly unsubscribing
      const rawEmail = body.email.trim();
      if (!rawEmail) {
        return NextResponse.json(
          { error: t.emailRequired },
          { status: 400 }
        );
      }
      if (!isValidEmail(rawEmail)) {
        return NextResponse.json(
          { error: t.invalidEmailFormat },
          { status: 400 }
        );
      }

      const rc = await verifyRecaptcha(body.recaptchaToken, 'unsubscribe');
      if (!rc.ok) {
        if (rc.reason === 'not_configured') {
          return NextResponse.json(
            { error: 'reCAPTCHA is not configured on the server.' },
            { status: 500 }
          );
        }
        if (rc.reason === 'missing_token') {
          return NextResponse.json({ error: t.recaptchaRequired }, { status: 400 });
        }
        return NextResponse.json({ error: t.recaptchaFailed }, { status: 400 });
      }

      const normalizedEmail = rawEmail.toLowerCase();

      try {
        const token = generateUnsubscribeToken(normalizedEmail);
        await sendUnsubscribeConfirmationEmail(normalizedEmail, token);
      } catch (err) {
        console.error('[Unsubscribe API] Failed to send confirmation email:', err);
        // Return generic success to avoid leaking whether the email exists
      }

      const message = lang === 'en'
        ? 'A confirmation email has been sent. Please check your inbox to confirm unsubscription.'
        : '確認退訂郵件已發送，請檢查您的信箱。';

      return NextResponse.json(
        { success: true, message, confirmationSent: true },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { error: t.unsubscribeTokenRequired },
        { status: 400 }
      );
    }

    const err = await applyUnsubscribe(email, 'post_token');
    if (err) {
      console.error('[Unsubscribe API] soft-unsubscribe error:', err);
      return NextResponse.json(
        { error: t.unsubscribeFailed },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: t.unsubscribeSuccess },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Unsubscribe API] Unexpected error:', error);
    return NextResponse.json(
      { error: t.unsubscribeFailed },
      { status: 500 }
    );
  }
}
