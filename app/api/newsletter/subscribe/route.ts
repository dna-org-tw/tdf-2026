import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendSubscriptionThankYouEmail } from '@/lib/email';
import { content } from '@/data/content';

const recaptchaApiKey = process.env.RECAPTCHA_API_KEY;
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6Lcu81gsAAAAAIrVoGK7urIEt9_w7gOoUSjzC5Uv';
const recaptchaProjectId = process.env.RECAPTCHA_PROJECT_ID || 'tdna-1769599168858';

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

// Helper function to get client IP address
function getClientIP(req: NextRequest): string | null {
  // 嘗試從各種請求頭獲取真實 IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for 可能包含多个IP，取第一个
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = req.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // 如果都沒有，嘗試從請求 URL 獲取（開發環境）
  try {
    const url = new URL(req.url);
    return url.hostname;
  } catch {
    return null;
  }
}

// Helper function to get country from IP using ipapi.co (free tier)
async function getCountryFromIP(ip: string | null): Promise<string | null> {
  if (!ip || ip === 'localhost' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null; // 本地IP或私有IP
  }

  try {
    // 使用 ipapi.co 免費 API（無需 API key，限制：1000 次/天）
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

    // 簡單的 Email 格式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: t.invalidEmailFormat },
        { status: 400 }
      );
    }

    // Verify reCAPTCHA Enterprise
    if (recaptchaApiKey) {
      const { recaptchaToken } = body;
      
      if (!recaptchaToken) {
        return NextResponse.json(
          { error: t.recaptchaRequired },
          { status: 400 }
        );
      }

      try {
        const requestBody = {
          event: {
            token: recaptchaToken,
            expectedAction: 'subscribe',
            siteKey: recaptchaSiteKey,
          },
        };

        const recaptchaResponse = await fetch(
          `https://recaptchaenterprise.googleapis.com/v1/projects/${recaptchaProjectId}/assessments?key=${recaptchaApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (!recaptchaResponse.ok) {
          const errorData = await recaptchaResponse.text();
          console.error('[reCAPTCHA Enterprise] API error:', errorData);
          return NextResponse.json(
            { error: t.recaptchaFailed },
            { status: 400 }
          );
        }

        const recaptchaData = await recaptchaResponse.json();

        // Enterprise API 返回的格式不同，检查 tokenProperties
        if (!recaptchaData.tokenProperties?.valid || recaptchaData.tokenProperties?.action !== 'subscribe') {
          return NextResponse.json(
            { error: t.recaptchaFailed },
            { status: 400 }
          );
        }

        // 检查风险评分（如果可用）
        if (recaptchaData.riskAnalysis?.score !== undefined) {
          const score = recaptchaData.riskAnalysis.score;
          // 分数范围 0.0-1.0，越低表示越可疑
          // 可以根據需要設定閾值，例如低於 0.5 拒絕
          if (score < 0.5) {
            return NextResponse.json(
              { error: t.recaptchaFailed },
              { status: 400 }
            );
          }
        }
      } catch (error) {
        console.error('[reCAPTCHA Enterprise] Verification error:', error);
        return NextResponse.json(
          { error: t.recaptchaFailed },
          { status: 400 }
        );
      }
    }

    // 獲取 IP 地址和國家資訊
    const clientIP = getClientIP(req);
    const country = clientIP ? await getCountryFromIP(clientIP) : null;
    
    // 獲取時區和語言區域（從前端發送）
    const timezone = body.timezone || null;
    const locale = body.locale || null;

    // 插入資料到 Supabase
    const insertData: Record<string, unknown> = {
      email,
      source: body.source || 'hero_section',
      created_at: new Date().toISOString(),
    };

    // 添加可选字段
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
      // 如果是重複的 email（根據你的資料表設定，可能會有唯一約束）
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

    // 訂閱成功後，發送感謝郵件（非阻塞，不影響響應）
    sendSubscriptionThankYouEmail(email).catch((emailError) => {
      console.error('[Newsletter API] Failed to send thank you email:', emailError);
      // 不影響訂閱成功的響應
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
