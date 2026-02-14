import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * 從 Supabase 的 ig_posts 表獲取所有數據
 * 不做任何過濾，直接回傳所有原始數據
 */
async function fetchAllIgPosts(): Promise<unknown[]> {
  if (!supabaseServer) {
    console.warn('[Award API] Supabase client not configured.');
    return [];
  }

  try {
    // 從 ig_posts 表查詢所有數據，不做任何過濾
    const { data: posts, error } = await supabaseServer
      .from('ig_posts')
      .select('*');

    if (error) {
      console.error('[Award API] Failed to fetch posts from ig_posts table:', {
        error: error,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      
      // 如果表不存在，嘗試查詢 award_posts 表作為備選
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        const { data: awardPosts, error: awardError } = await supabaseServer
          .from('award_posts')
          .select('*');
        
        if (awardError) {
          console.error('[Award API] Failed to fetch posts from award_posts table:', awardError);
          return [];
        }
        
        return awardPosts || [];
      }
      
      return [];
    }

    if (!posts || posts.length === 0) {
      return [];
    }

    // 處理數據格式，但保留所有數據
    const processedPosts: unknown[] = [];

    for (const post of posts) {
      try {
        // 處理不同的數據儲存格式
        let postData: unknown;
        
        if (typeof post === 'string') {
          // 如果整个 post 是字符串，尝试解析
          postData = JSON.parse(post);
        } else if (typeof post === 'object' && post !== null) {
          // 檢查是否有 data 欄位（JSONB 格式）
          if ('data' in post && post.data) {
            // 如果 data 是字串，需要解析
            if (typeof post.data === 'string') {
              postData = JSON.parse(post.data);
            } else {
              // 如果 data 已經是物件，直接使用
              postData = post.data;
            }
          } else {
            // 如果沒有 data 欄位，假設整個物件就是數據
            postData = post;
          }
        } else {
          // 即使格式不同，也保留原始數據
          postData = post;
        }

        // 不跳過任何數據，全部添加
        processedPosts.push(postData);
      } catch (parseError) {
        // 即使解析錯誤，也保留原始數據
        console.warn('[Award API] Error parsing post data, keeping raw data:', parseError);
        processedPosts.push(post);
      }
    }

    return processedPosts;
  } catch (error) {
    console.error('[Award API] Failed to fetch posts from database:', error);
    return [];
  }
}

// 禁用緩存，確保每次請求都會執行
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 從 ig_posts 表獲取所有數據，不做任何過濾
    const posts = await fetchAllIgPosts();
    
    return NextResponse.json(
      { 
        success: true, 
        message: `Fetched ${posts.length} posts from ig_posts table (no filtering)`,
        posts_count: posts.length,
        posts: posts,
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('[Award API] Error in GET request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // 檢查 Supabase 連線
    if (!supabaseServer) {
      console.error('[Award API] Supabase client is not configured');
      return NextResponse.json(
        { 
          error: 'Database not configured', 
          details: 'Supabase client is not initialized. Please check environment variables.',
          success: false,
          posts_count: 0,
          posts: []
        },
        { status: 500 }
      );
    }
    
    // 從 ig_posts 表獲取所有數據，不做任何過濾
    const posts = await fetchAllIgPosts();
    
    return NextResponse.json(
      { 
        success: true, 
        message: `Fetched ${posts.length} posts from ig_posts table (no filtering)`,
        posts_count: posts.length,
        posts: posts,
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('[Award API] Error in POST request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch posts', 
        details: errorMessage,
        stack: errorStack,
        success: false,
        posts_count: 0,
        posts: []
      },
      { status: 500 }
    );
  }
}
