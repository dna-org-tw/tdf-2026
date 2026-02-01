import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// 设置缓存策略：最多缓存 60 秒，但允许重新验证
export const revalidate = 60;

/**
 * 计算随时间递增的 magic number
 * 基于一个起始日期，每天递增一定数量，让总数看起来有 1000+ 人关注
 */
function calculateMagicNumber(): number {
  // 设置起始日期（例如：活动开始宣传的日期）
  const startDate = new Date('2025-01-01T00:00:00Z');
  const now = new Date();
  
  // 计算从起始日期到现在的天数
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // 基础 magic number：500
  // 每天递增固定数量
  const baseMagicNumber = 500;
  const dailyIncrement = 3; // 固定每天递增 3 个
  const totalIncrement = daysSinceStart * dailyIncrement;
  
  return baseMagicNumber + totalIncrement;
}

export async function GET() {
  try {
    let actualCount = 0;
    
    if (supabaseServer) {
      // 获取 newsletter_subscriptions 表的总数
      const { count, error } = await supabaseServer
        .from('newsletter_subscriptions')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('[Newsletter Count API] Error:', error);
        // 即使数据库查询失败，也返回 magic number
      } else {
        actualCount = count || 0;
      }
    }

    // 计算 magic number
    const magicNumber = calculateMagicNumber();
    
    // 实际数量 + magic number = 显示的总数
    // 确保总数至少是 magic number（如果实际数量很少）
    const totalCount = Math.max(actualCount + magicNumber, magicNumber);

    return NextResponse.json(
      { count: totalCount },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Newsletter Count API] Unexpected error:', error);
    // 即使出错，也返回 magic number
    const magicNumber = calculateMagicNumber();
    return NextResponse.json(
      { count: magicNumber },
      { status: 200 }
    );
  }
}
