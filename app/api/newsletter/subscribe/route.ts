import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendSubscriptionThankYouEmail } from '@/lib/email';

const recaptchaApiKey = process.env.RECAPTCHA_API_KEY;
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6Lcu81gsAAAAAIrVoGK7urIEt9_w7gOoUSjzC5Uv';
const recaptchaProjectId = process.env.RECAPTCHA_PROJECT_ID || 'tdna-1769599168858';

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Supabase 服務端尚未設定完成。' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || !body.email) {
      return NextResponse.json(
        { error: '請提供有效的 Email 地址。' },
        { status: 400 }
      );
    }

    const email = body.email.trim();

    // 簡單的 Email 格式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email 格式不正確。' },
        { status: 400 }
      );
    }

    // Verify reCAPTCHA Enterprise
    if (recaptchaApiKey) {
      const { recaptchaToken } = body;
      
      if (!recaptchaToken) {
        return NextResponse.json(
          { error: 'reCAPTCHA 验证是必需的。' },
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
            { error: 'reCAPTCHA 验证失败，请稍后重试。' },
            { status: 400 }
          );
        }

        const recaptchaData = await recaptchaResponse.json();

        // Enterprise API 返回的格式不同，检查 tokenProperties
        if (!recaptchaData.tokenProperties?.valid || recaptchaData.tokenProperties?.action !== 'subscribe') {
          return NextResponse.json(
            { error: 'reCAPTCHA 验证失败，请稍后重试。' },
            { status: 400 }
          );
        }

        // 检查风险评分（如果可用）
        if (recaptchaData.riskAnalysis?.score !== undefined) {
          const score = recaptchaData.riskAnalysis.score;
          // 分数范围 0.0-1.0，越低表示越可疑
          // 可以根据需要设置阈值，例如低于 0.5 拒绝
          if (score < 0.5) {
            return NextResponse.json(
              { error: 'reCAPTCHA 验证失败，请稍后重试。' },
              { status: 400 }
            );
          }
        }
      } catch (error) {
        console.error('[reCAPTCHA Enterprise] Verification error:', error);
        return NextResponse.json(
          { error: 'reCAPTCHA 验证失败，请稍后重试。' },
          { status: 400 }
        );
      }
    }

    // 插入資料到 Supabase
    const { error, data } = await supabaseServer
      .from('newsletter_subscriptions')
      .insert({
        email,
        source: body.source || 'hero_section',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // 如果是重複的 email（根據你的資料表設定，可能會有唯一約束）
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '此 Email 已經訂閱過了。', duplicate: true },
          { status: 409 }
        );
      }

      console.error('[Newsletter API] Supabase insert error:', error);
      return NextResponse.json(
        { error: '訂閱失敗，請稍後再試。' },
        { status: 500 }
      );
    }

    // 訂閱成功後，發送感謝郵件（非阻塞，不影響響應）
    sendSubscriptionThankYouEmail(email).catch((emailError) => {
      console.error('[Newsletter API] Failed to send thank you email:', emailError);
      // 不影響訂閱成功的響應
    });

    return NextResponse.json(
      { success: true, message: '已成功訂閱！感謝你的關注 🙌', data },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Newsletter API] Unexpected error:', error);
    return NextResponse.json(
      { error: '訂閱失敗，請稍後再試。' },
      { status: 500 }
    );
  }
}
