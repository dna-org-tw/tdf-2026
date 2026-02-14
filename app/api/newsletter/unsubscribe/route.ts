import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyUnsubscribeToken } from '@/lib/email';
import { content } from '@/data/content';

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

    // 從資料庫中刪除訂閱記錄
    const { error } = await supabaseServer
      .from('newsletter_subscriptions')
      .delete()
      .eq('email', email);

    if (error) {
      console.error('[Unsubscribe API] Supabase delete error:', error);
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
      // 直接以 email 取消訂閱
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
      email = rawEmail.toLowerCase();
    } else {
      return NextResponse.json(
        { error: t.unsubscribeTokenRequired },
        { status: 400 }
      );
    }

    // 從資料庫中刪除訂閱記錄
    const { error } = await supabaseServer
      .from('newsletter_subscriptions')
      .delete()
      .eq('email', email);

    if (error) {
      console.error('[Unsubscribe API] Supabase delete error:', error);
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
