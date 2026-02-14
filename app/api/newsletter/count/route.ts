import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// 設定快取策略：最多快取 60 秒，但允許重新驗證
export const revalidate = 60;

/**
 * 計算隨時間遞增的 magic number
 * 基於一個起始日期，每天遞增一定數量，讓總數看起來有 1000+ 人關注
 */
function calculateMagicNumber(): number {
  // 設定起始日期（例如：活動開始宣傳的日期）
  const startDate = new Date('2025-01-01T00:00:00Z');
  const now = new Date();
  
  // 計算從起始日期到現在的天數
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // 基礎 magic number：500
  // 每天遞增固定數量
  const baseMagicNumber = 500;
  const dailyIncrement = 3; // 固定每天遞增 3 個
  const totalIncrement = daysSinceStart * dailyIncrement;
  
  return baseMagicNumber + totalIncrement;
}

export async function GET() {
  try {
    let actualCount = 0;
    
    if (supabaseServer) {
      // 獲取 newsletter_subscriptions 表的總數
      const { count, error } = await supabaseServer
        .from('newsletter_subscriptions')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('[Newsletter Count API] Error:', error);
        // 即使資料庫查詢失敗，也回傳 magic number
      } else {
        actualCount = count || 0;
      }
    }

    // 計算 magic number
    const magicNumber = calculateMagicNumber();
    
    // 實際數量 + magic number = 顯示的總數
    // 確保總數至少是 magic number（如果實際數量很少）
    const totalCount = Math.max(actualCount + magicNumber, magicNumber);

    return NextResponse.json(
      { count: totalCount },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Newsletter Count API] Unexpected error:', error);
    // 即使出錯，也回傳 magic number
    const magicNumber = calculateMagicNumber();
    return NextResponse.json(
      { count: magicNumber },
      { status: 200 }
    );
  }
}
