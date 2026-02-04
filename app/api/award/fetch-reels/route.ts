import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * 从 Supabase 的 ig_posts 表获取所有数据
 * 不做任何过滤，直接返回所有原始数据
 */
async function fetchAllIgPosts(): Promise<unknown[]> {
  if (!supabaseServer) {
    console.warn('[Award API] Supabase client not configured.');
    return [];
  }

  try {
    // 从 ig_posts 表查询所有数据，不做任何过滤
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
      
      // 如果表不存在，尝试查询 award_posts 表作为备选
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

    // 处理数据格式，但保留所有数据
    const processedPosts: unknown[] = [];

    for (const post of posts) {
      try {
        // 处理不同的数据存储格式
        let postData: unknown;
        
        if (typeof post === 'string') {
          // 如果整个 post 是字符串，尝试解析
          postData = JSON.parse(post);
        } else if (typeof post === 'object' && post !== null) {
          // 检查是否有 data 字段（JSONB 格式）
          if ('data' in post && post.data) {
            // 如果 data 是字符串，需要解析
            if (typeof post.data === 'string') {
              postData = JSON.parse(post.data);
            } else {
              // 如果 data 已经是对象，直接使用
              postData = post.data;
            }
          } else {
            // 如果没有 data 字段，假设整个对象就是数据
            postData = post;
          }
        } else {
          // 即使格式不同，也保留原始数据
          postData = post;
        }

        // 不跳过任何数据，全部添加
        processedPosts.push(postData);
      } catch (parseError) {
        // 即使解析错误，也保留原始数据
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
    // 从 ig_posts 表获取所有数据，不做任何过滤
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
    // 检查 Supabase 连接
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
    
    // 从 ig_posts 表获取所有数据，不做任何过滤
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
