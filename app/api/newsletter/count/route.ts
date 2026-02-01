import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// 设置缓存策略：最多缓存 60 秒，但允许重新验证
export const revalidate = 60;

export async function GET() {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { count: 0, error: 'Database not configured' },
        { status: 500 }
      );
    }

    // 获取 newsletter_subscriptions 表的总数
    const { count, error } = await supabaseServer
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('[Newsletter Count API] Error:', error);
      return NextResponse.json(
        { count: 0, error: error.message },
        { status: 500 }
      );
    }

    // 返回计数，如果没有数据则返回 0
    return NextResponse.json(
      { count: count || 0 },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Newsletter Count API] Unexpected error:', error);
    return NextResponse.json(
      { count: 0, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
