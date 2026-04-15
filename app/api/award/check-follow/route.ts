import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyRecaptcha } from '@/lib/recaptcha';

/**
 * 檢查使用者是否已關注（訂閱 newsletter）
 */
export async function POST(req: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || !body.email) {
      return NextResponse.json(
        { error: 'Missing email field' },
        { status: 400 }
      );
    }

    const email = body.email.trim().toLowerCase();

    // 驗證 Email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const rc = await verifyRecaptcha(body.recaptchaToken, 'check_follow');
    if (!rc.ok) {
      if (rc.reason === 'not_configured') {
        return NextResponse.json(
          { error: 'reCAPTCHA is not configured on the server.' },
          { status: 500 }
        );
      }
      if (rc.reason === 'missing_token') {
        return NextResponse.json(
          { error: 'reCAPTCHA verification is required' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed' },
        { status: 400 }
      );
    }

    // 檢查是否已訂閱 newsletter
    const { data: subscription, error: subscriptionError } = await supabaseServer
      .from('newsletter_subscriptions')
      .select('email')
      .eq('email', email)
      .limit(1);

    if (subscriptionError) {
      console.error('[Award Check Follow API] Error checking subscription:', subscriptionError);
      return NextResponse.json(
        { error: 'Failed to check subscription status', details: subscriptionError.message },
        { status: 500 }
      );
    }

    const isFollowing = subscription && subscription.length > 0;

    return NextResponse.json(
      { 
        isFollowing,
        message: isFollowing 
          ? 'User is following' 
          : 'User is not following'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Award Check Follow API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to check follow status' },
      { status: 500 }
    );
  }
}
