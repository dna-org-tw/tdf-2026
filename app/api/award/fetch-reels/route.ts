import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * 從 Supabase 的 ig_posts 表獲取所有資料
 * 不做任何過濾，直接回傳所有原始資料
 */
async function fetchAllIgPosts(): Promise<unknown[]> {
  if (!supabaseServer) {
    console.warn('[Award API] Supabase client not configured.');
    return [];
  }

  try {
    // 從 ig_posts 表查詢所有資料，不做任何過濾
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

    // 處理資料格式，但保留所有資料
    const processedPosts: unknown[] = [];

    for (const post of posts) {
      try {
        // 處理不同的資料儲存格式
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
            // 如果沒有 data 欄位，假設整個物件就是資料
            postData = post;
          }
        } else {
          // 即使格式不同，也保留原始資料
          postData = post;
        }

        // 不跳過任何資料，全部新增
        processedPosts.push(postData);
      } catch (parseError) {
        // 即使解析錯誤，也保留原始資料
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
    // 從 ig_posts 表獲取所有資料，不做任何過濾
    const posts = await fetchAllIgPosts();
    
    const filteredPosts = posts.map((post) => {
      const p = post as Record<string, unknown>;
      return {
        id: p.id,
        shortcode: p.shortcode,
        thumbnail_url: p.thumbnail_url,
        caption: p.caption,
        username: p.username,
        permalink: p.permalink,
        media_type: p.media_type,
        timestamp: p.timestamp,
      };
    });

    return NextResponse.json(
      {
        success: true,
        posts_count: filteredPosts.length,
        posts: filteredPosts,
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
      { error: 'Failed to fetch posts', success: false, posts_count: 0, posts: [] },
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
          success: false,
          posts_count: 0,
          posts: []
        },
        { status: 500 }
      );
    }

    // 從 ig_posts 表獲取所有資料，不做任何過濾
    const posts = await fetchAllIgPosts();

    const filteredPosts = posts.map((post) => {
      const p = post as Record<string, unknown>;
      return {
        id: p.id,
        shortcode: p.shortcode,
        thumbnail_url: p.thumbnail_url,
        caption: p.caption,
        username: p.username,
        permalink: p.permalink,
        media_type: p.media_type,
        timestamp: p.timestamp,
      };
    });

    return NextResponse.json(
      {
        success: true,
        posts_count: filteredPosts.length,
        posts: filteredPosts,
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
    return NextResponse.json(
      { error: 'Failed to fetch posts', success: false, posts_count: 0, posts: [] },
      { status: 500 }
    );
  }
}
