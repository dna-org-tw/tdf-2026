import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// Instagram API 配置
// 注意：需要配置 Instagram Graph API 或使用其他方式获取贴文
// 这里提供一个基础结构，可以后续集成真实的 Instagram API
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_USER_ID = process.env.INSTAGRAM_USER_ID;

interface InstagramPost {
  id: string;
  // 基础字段（向后兼容）
  permalink: string;
  media_url: string;
  caption?: string;
  username: string;
  timestamp: string;
  vote_count: number;
  // API 返回的主要字段
  input_url?: string | null;
  post_type?: string | null;
  type?: string | null;
  short_code?: string | null;
  url?: string | null;
  // 媒体信息
  display_url?: string | null;
  video_url?: string | null;
  dimensions_height?: number | null;
  dimensions_width?: number | null;
  // 互动数据
  likes_count?: number | null;
  comments_count?: number | null;
  video_play_count?: number | null;
  ig_play_count?: number | null;
  fb_like_count?: number | null;
  fb_play_count?: number | null;
  video_duration?: number | null;
  // 用户信息
  owner_full_name?: string | null;
  owner_username?: string | null;
  owner_id?: string | null;
  // 其他信息
  first_comment?: string | null;
  location_name?: string | null;
  product_type?: string | null;
  // 数组和复杂对象
  hashtags?: string[] | null;
  mentions?: string[] | null;
  images?: string[] | null;
  latest_comments?: unknown[] | null;
  child_posts?: unknown[] | null;
  tagged_users?: unknown[] | null;
  music_info?: unknown | null;
  coauthor_producers?: unknown[] | null;
}

/**
 * 从 Instagram Graph API 获取带有特定标签的贴文
 * 注意：Instagram Graph API 需要通过 Hashtag Search 来获取贴文
 * 这需要 Instagram Business Account 和相应的权限
 */
async function fetchInstagramPosts(): Promise<InstagramPost[]> {
  // TODO: 集成真实的 Instagram API
  // 这里提供一个示例结构，实际需要：
  // 1. 使用 Instagram Graph API 的 Hashtag Search
  // 2. 搜索标签 #taiwandigitalfest 和 #taiwandigitalfest
  // 3. 获取贴文数据
  
  // 临时返回空数组，实际应该从 Instagram API 获取
  // 或者使用第三方服务如 RapidAPI 的 Instagram scraper
  
  if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_USER_ID) {
    console.warn('[Award API] Instagram credentials not configured. Returning empty posts.');
    return [];
  }

  try {
    // 示例：使用 Instagram Graph API 获取贴文
    // 注意：实际实现需要根据 Instagram API 的最新文档
    // const response = await fetch(
    //   `https://graph.instagram.com/${INSTAGRAM_USER_ID}/media?fields=id,caption,media_type,media_url,permalink,timestamp,username&access_token=${INSTAGRAM_ACCESS_TOKEN}`
    // );
    // const data = await response.json();
    
    // 从数据库获取投票数
    const { data: votes } = supabaseServer
      ? await supabaseServer
          .from('award_votes')
          .select('post_id, count')
          .eq('confirmed', true)
      : { data: null };

    const voteCounts: Record<string, number> = {};
    if (votes) {
      votes.forEach((vote: { post_id: string }) => {
        voteCounts[vote.post_id] = (voteCounts[vote.post_id] || 0) + 1;
      });
    }

    // 这里应该处理从 Instagram API 获取的数据
    // 并合并投票数
    return [];
  } catch (error) {
    console.error('[Award API] Failed to fetch Instagram posts:', error);
    return [];
  }
}

/**
 * 从数据库获取已存储的贴文（如果使用数据库存储贴文数据）
 */
async function getStoredPosts(): Promise<InstagramPost[]> {
  if (!supabaseServer) {
    return [];
  }

  try {
    const { data: posts, error } = await supabaseServer
      .from('award_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Award API] Failed to fetch stored posts:', error);
      return [];
    }

    // 获取每个贴文的投票数
    const { data: votes } = supabaseServer
      ? await supabaseServer
          .from('award_votes')
          .select('post_id')
          .eq('confirmed', true)
      : { data: null };

    const voteCounts: Record<string, number> = {};
    if (votes) {
      votes.forEach((vote: { post_id: string }) => {
        voteCounts[vote.post_id] = (voteCounts[vote.post_id] || 0) + 1;
      });
    }

    return (posts || []).map((post: {
      id: string;
      permalink?: string;
      media_url?: string;
      caption?: string;
      username?: string;
      timestamp?: string;
      created_at?: string;
      input_url?: string;
      post_type?: string;
      short_code?: string;
      url?: string;
      display_url?: string;
      video_url?: string;
      dimensions_height?: number;
      dimensions_width?: number;
      likes_count?: number;
      comments_count?: number;
      video_play_count?: number;
      ig_play_count?: number;
      fb_like_count?: number;
      fb_play_count?: number;
      video_duration?: number;
      owner_full_name?: string;
      owner_username?: string;
      owner_id?: string;
      first_comment?: string;
      location_name?: string;
      product_type?: string;
      hashtags?: string[];
      mentions?: string[];
      images?: string[];
      latest_comments?: unknown[];
      child_posts?: unknown[];
      tagged_users?: unknown[];
      music_info?: unknown;
      coauthor_producers?: unknown[];
    }): InstagramPost => ({
      id: post.id,
      permalink: post.permalink || post.url || '',
      media_url: post.media_url || post.display_url || post.video_url || '',
      caption: post.caption || undefined,
      username: post.username || post.owner_username || '',
      timestamp: post.timestamp || post.created_at || new Date().toISOString(),
      vote_count: voteCounts[post.id] || 0,
      input_url: post.input_url || null,
      post_type: post.post_type || null,
      short_code: post.short_code || null,
      url: post.url || null,
      display_url: post.display_url || null,
      video_url: post.video_url || null,
      dimensions_height: post.dimensions_height || null,
      dimensions_width: post.dimensions_width || null,
      likes_count: post.likes_count || null,
      comments_count: post.comments_count || null,
      video_play_count: post.video_play_count || null,
      ig_play_count: post.ig_play_count || null,
      fb_like_count: post.fb_like_count || null,
      fb_play_count: post.fb_play_count || null,
      video_duration: post.video_duration || null,
      owner_full_name: post.owner_full_name || null,
      owner_username: post.owner_username || null,
      owner_id: post.owner_id || null,
      first_comment: post.first_comment || null,
      location_name: post.location_name || null,
      product_type: post.product_type || null,
      hashtags: post.hashtags || null,
      mentions: post.mentions || null,
      images: post.images || null,
      latest_comments: post.latest_comments || null,
      child_posts: post.child_posts || null,
      tagged_users: post.tagged_users || null,
      music_info: post.music_info || null,
      coauthor_producers: post.coauthor_producers || null,
    }));
  } catch (error) {
    console.error('[Award API] Error fetching stored posts:', error);
    return [];
  }
}

/**
 * 从 ig_posts 表获取数据（优先使用）
 */
async function getIgPosts(): Promise<InstagramPost[]> {
  if (!supabaseServer) {
    console.warn('[Award API] Supabase client not configured for getIgPosts');
    return [];
  }

  try {
    // 获取所有数据，然后按 data.timestamp 排序
    let { data: igPosts, error: igError } = await supabaseServer
      .from('ig_posts')
      .select('*');

    if (igError) {
      console.error('[Award API] Error fetching ig_posts:', igError);
      return [];
    }

    // 在内存中按 data.timestamp 排序
    if (igPosts && igPosts.length > 0) {
      igPosts.sort((a: any, b: any) => {
        const getTimestamp = (post: any): string => {
          if (post.data) {
            if (typeof post.data === 'object' && post.data.timestamp) {
              return post.data.timestamp;
            } else if (typeof post.data === 'string') {
              try {
                const parsed = JSON.parse(post.data);
                return parsed.timestamp || '';
              } catch {
                return '';
              }
            }
          }
          return post.timestamp || post.created_at || '';
        };
        
        const timestampA = getTimestamp(a);
        const timestampB = getTimestamp(b);
        
        // 降序排序（最新的在前）
        return timestampB.localeCompare(timestampA);
      });
    }

    if (igError) {
      console.error('[Award API] Error fetching ig_posts:', igError);
      return [];
    }

    if (!igPosts || igPosts.length === 0) {
      return [];
    }

    const processedPosts = await processIgPosts(igPosts);
    return processedPosts;
  } catch (error) {
    console.error('[Award API] Error fetching ig_posts:', error);
    return [];
  }
}

/**
 * 处理 ig_posts 数据并转换为 InstagramPost 格式
 */
async function processIgPosts(igPosts: any[]): Promise<InstagramPost[]> {
  // 获取每个贴文的投票数
  const voteCounts: Record<string, number> = {};
  
  if (supabaseServer) {
    try {
      const { data: votes } = await supabaseServer
        .from('award_votes')
        .select('post_id')
        .eq('confirmed', true);
      
      if (votes) {
        votes.forEach((vote: { post_id: string }) => {
          voteCounts[vote.post_id] = (voteCounts[vote.post_id] || 0) + 1;
        });
      }
    } catch (err) {
      console.warn('[Award API] Error fetching votes:', err);
    }
  }

  // 处理 ig_posts 数据格式
  return igPosts.map((post: any): InstagramPost => {
    // 处理 JSONB 数据
    let postData = post;
    if (post.data && typeof post.data === 'object') {
      postData = { ...post, ...post.data };
    } else if (post.data && typeof post.data === 'string') {
      try {
        postData = { ...post, ...JSON.parse(post.data) };
      } catch {
        postData = post;
      }
    }

    const postId = postData.id || post.id;
    
    // 优先使用 data.timestamp，然后才是其他字段
    let timestamp: string | undefined;
    if (post.data) {
      if (typeof post.data === 'object' && post.data.timestamp) {
        timestamp = post.data.timestamp;
      } else if (typeof post.data === 'string') {
        try {
          const parsedData = JSON.parse(post.data);
          if (parsedData && parsedData.timestamp) {
            timestamp = parsedData.timestamp;
          }
        } catch {
          // 解析失败，继续使用其他备选方案
        }
      }
    }
    
    // 如果 data.timestamp 不存在，使用其他备选方案（确保始终返回字符串）
    const finalTimestamp: string = timestamp || postData.timestamp || postData.created_at || post.created_at || new Date().toISOString();
    
    return {
      id: postId,
      permalink: postData.permalink || postData.url || `https://www.instagram.com/p/${postData.short_code || ''}/`,
      media_url: postData.media_url || postData.display_url || postData.displayUrl || (postData.images && postData.images[0]) || '',
      caption: postData.caption || undefined,
      username: postData.username || postData.owner_username || postData.ownerUsername || '',
      timestamp: finalTimestamp,
      vote_count: voteCounts[postId] || 0,
      input_url: postData.input_url || postData.inputUrl || null,
      post_type: postData.post_type || postData.type || null,
      type: postData.type || postData.post_type || null,
      short_code: postData.short_code || null,
      url: postData.url || null,
      display_url: postData.display_url || postData.displayUrl || null,
      video_url: postData.video_url || null,
      dimensions_height: postData.dimensions_height || postData.dimensionsHeight || null,
      dimensions_width: postData.dimensions_width || postData.dimensionsWidth || null,
      likes_count: postData.likes_count || postData.likesCount || null,
      comments_count: postData.comments_count || postData.commentsCount || null,
      video_play_count: postData.video_play_count || postData.videoPlayCount || null,
      ig_play_count: postData.ig_play_count || null,
      fb_like_count: postData.fb_like_count || null,
      fb_play_count: postData.fb_play_count || null,
      video_duration: postData.video_duration || null,
      owner_full_name: postData.owner_full_name || postData.ownerFullName || null,
      owner_username: postData.owner_username || postData.ownerUsername || null,
      owner_id: postData.owner_id || postData.ownerId || null,
      first_comment: postData.first_comment || null,
      location_name: postData.location_name || null,
      product_type: postData.product_type || postData.productType || null,
      hashtags: postData.hashtags || null,
      mentions: postData.mentions || null,
      images: postData.images || null,
      latest_comments: postData.latest_comments || postData.latestComments || null,
      child_posts: postData.child_posts || postData.childPosts || null,
      tagged_users: postData.tagged_users || postData.taggedUsers || null,
      music_info: postData.music_info || postData.musicInfo || null,
      coauthor_producers: postData.coauthor_producers || postData.coauthorProducers || null,
    };
  });
}

export async function GET(_req: NextRequest) {
  try {
    // 优先从 ig_posts 表获取所有数据
    let posts = await getIgPosts();

    // 如果 ig_posts 表中没有数据，尝试从 award_posts 表获取
    if (posts.length === 0) {
      posts = await getStoredPosts();
    }

    // 如果数据库中没有贴文，尝试从 Instagram API 获取
    if (posts.length === 0) {
      posts = await fetchInstagramPosts();
    }
    return NextResponse.json(
      { 
        success: true, 
        posts,
        total: posts.length,
        source: posts.length > 0 ? 'ig_posts' : 'fallback'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Award API] Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
