import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendSubscriptionThankYouEmail } from '@/lib/email';
import { content } from '@/data/content';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { getClientIP } from '@/lib/clientIp';

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

// Helper function to get country from IP using ipapi.co (free tier)
async function getCountryFromIP(ip: string | null): Promise<string | null> {
  if (!ip || ip === 'localhost' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null; // Local or private IP
  }

  try {
    // Use ipapi.co free API (no API key needed; limit: 1000 requests/day)
    const response = await fetch(`https://ipapi.co/${ip}/country/`, {
      headers: {
        'User-Agent': 'Taiwan-Digital-Fest-2026',
      },
    });

    if (response.ok) {
      const country = await response.text();
      return country.trim() || null;
    }
  } catch (error) {
    console.error('[IP Geolocation] Failed to get country from IP:', error);
  }

  return null;
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

    const body = await req.json().catch(() => null);

    if (!body || !body.email) {
      return NextResponse.json(
        { error: t.emailRequired },
        { status: 400 }
      );
    }

    const email = body.email.trim();

    // Simple email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: t.invalidEmailFormat },
        { status: 400 }
      );
    }

    const { recaptchaToken } = body;
    const rc = await verifyRecaptcha(recaptchaToken, 'subscribe');
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

    // Get IP address and country info
    const clientIP = getClientIP(req);
    const country = clientIP ? await getCountryFromIP(clientIP) : null;
    
    // Get timezone and locale (sent from frontend)
    const timezone = body.timezone || null;
    const locale = body.locale || null;

    // Check for existing row so we can reactivate previously-unsubscribed addresses
    // instead of returning 409 and stranding the user in an unsubscribed state.
    // Note: newsletter_subscriptions has email as PK (no id column) — key by email.
    const { data: existing } = await supabaseServer
      .from('newsletter_subscriptions')
      .select('email, unsubscribed_at')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      if (existing.unsubscribed_at) {
        const { data: updated, error: updateError } = await supabaseServer
          .from('newsletter_subscriptions')
          .update({
            unsubscribed_at: null,
            pref_newsletter: true,
            pref_events: true,
            pref_award: true,
          })
          .eq('email', email)
          .select()
          .single();

        if (updateError) {
          console.error('[Newsletter API] Reactivation update error:', updateError);
          return NextResponse.json(
            { error: t.subscriptionFailed },
            { status: 500 }
          );
        }

        // Only clear 'unsubscribed' suppressions. Bounces, spam complaints,
        // and manual blocks are deliverability signals that must survive
        // a re-subscribe — otherwise a complainer can keep re-adding themselves.
        const normalizedEmail = email.toLowerCase();
        const { data: existingSuppression, error: suppressionLookupError } = await supabaseServer
          .from('email_suppressions')
          .select('reason')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (suppressionLookupError) {
          console.error('[Newsletter API] Suppression lookup failed:', suppressionLookupError);
        } else if (existingSuppression && existingSuppression.reason === 'unsubscribed') {
          const { error: suppressionError } = await supabaseServer
            .from('email_suppressions')
            .delete()
            .eq('email', normalizedEmail)
            .eq('reason', 'unsubscribed');
          if (suppressionError) {
            console.error('[Newsletter API] Suppression cleanup failed:', suppressionError);
          }
        } else if (existingSuppression) {
          console.warn(
            '[Newsletter API] Reactivation kept non-unsubscribe suppression',
            { email: normalizedEmail, reason: existingSuppression.reason },
          );
        }

        sendSubscriptionThankYouEmail(email).catch((emailError) => {
          console.error('[Newsletter API] Failed to send thank you email:', emailError);
        });

        return NextResponse.json(
          { success: true, message: t.subscriptionSuccess, data: updated, reactivated: true },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: t.alreadySubscribed, duplicate: true },
        { status: 409 }
      );
    }

    // Insert data into Supabase
    const insertData: Record<string, unknown> = {
      email,
      source: body.source || 'hero_section',
      created_at: new Date().toISOString(),
    };

    // Add optional fields
    if (timezone) insertData.timezone = timezone;
    if (clientIP) insertData.ip_address = clientIP;
    if (country) insertData.country = country;
    if (locale) insertData.locale = locale;
    if (body.visitor_fingerprint) insertData.visitor_fingerprint = body.visitor_fingerprint;

    const { error, data } = await supabaseServer
      .from('newsletter_subscriptions')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // Race: row was created between the SELECT and INSERT above. Treat as duplicate.
      if (error.code === '23505') {
        return NextResponse.json(
          { error: t.alreadySubscribed, duplicate: true },
          { status: 409 }
        );
      }

      console.error('[Newsletter API] Supabase insert error:', error);
      return NextResponse.json(
        { error: t.subscriptionFailed },
        { status: 500 }
      );
    }

    // After successful subscription, send thank-you email (non-blocking)
    sendSubscriptionThankYouEmail(email).catch((emailError) => {
      console.error('[Newsletter API] Failed to send thank you email:', emailError);
      // Don't affect the successful subscription response
    });

    return NextResponse.json(
      { success: true, message: t.subscriptionSuccess, data },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Newsletter API] Unexpected error:', error);
    return NextResponse.json(
      { error: t.subscriptionFailed },
      { status: 500 }
    );
  }
}
