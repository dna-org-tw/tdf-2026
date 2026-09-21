import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { enforceRateLimit } from '@/lib/rateLimitResponse';

/**
 * Fetch all data from the ig_posts table in Supabase
 * No filtering applied; returns all raw data as-is
 */
async function fetchAllIgPosts(): Promise<unknown[]> {
  if (!supabaseServer) {
    console.warn('[Award API] Supabase client not configured.');
    return [];
  }

  try {
    // Query all data from ig_posts table without filtering
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
      return [];
    }

    if (!posts || posts.length === 0) {
      return [];
    }

    // Process data format but keep all data
    const processedPosts: unknown[] = [];

    for (const post of posts) {
      try {
        // Handle different data storage formats
        let postData: unknown;
        
        if (typeof post === 'string') {
          // If the entire post is a string, try to parse it
          postData = JSON.parse(post);
        } else if (typeof post === 'object' && post !== null) {
          // Check for a data field (JSONB format)
          if ('data' in post && post.data) {
            // If data is a string, parse it
            if (typeof post.data === 'string') {
              postData = JSON.parse(post.data);
            } else {
              // If data is already an object, use it directly
              postData = post.data;
            }
          } else {
            // If no data field, assume the entire object is the data
            postData = post;
          }
        } else {
          // Even if format differs, keep the raw data
          postData = post;
        }

        // Don't skip any data; add everything
        processedPosts.push(postData);
      } catch (parseError) {
        // Even on parse error, keep the raw data
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

// Disable caching so every request executes fresh
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, { key: 'fetch-reels', limit: 120, windowSeconds: 60 });
  if (rl) return rl;

  try {
    // Fetch all data from ig_posts table without filtering
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

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, { key: 'fetch-reels', limit: 120, windowSeconds: 60 });
  if (rl) return rl;

  try {
    // Check Supabase connection
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

    // Fetch all data from ig_posts table without filtering
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
