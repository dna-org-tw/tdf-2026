import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyUnsubscribeToken } from '@/lib/email';

export async function GET(req: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Supabase 服務端尚未設定完成。' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: '缺少取消訂閱的 token。' },
        { status: 400 }
      );
    }

    // 驗證 token 並獲取 email
    const email = verifyUnsubscribeToken(token);

    if (!email) {
      return NextResponse.json(
        { error: '無效的取消訂閱連結。' },
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
        { error: '取消訂閱失敗，請稍後再試。' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: '已成功取消訂閱。' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Unsubscribe API] Unexpected error:', error);
    return NextResponse.json(
      { error: '取消訂閱失敗，請稍後再試。' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Supabase 服務端尚未設定完成。' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || !body.token) {
      return NextResponse.json(
        { error: '請提供有效的取消訂閱 token。' },
        { status: 400 }
      );
    }

    const { token } = body;

    // 驗證 token 並獲取 email
    const email = verifyUnsubscribeToken(token);

    if (!email) {
      return NextResponse.json(
        { error: '無效的取消訂閱 token。' },
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
        { error: '取消訂閱失敗，請稍後再試。' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: '已成功取消訂閱。' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Unsubscribe API] Unexpected error:', error);
    return NextResponse.json(
      { error: '取消訂閱失敗，請稍後再試。' },
      { status: 500 }
    );
  }
}
