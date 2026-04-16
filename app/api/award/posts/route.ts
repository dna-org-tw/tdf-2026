import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// Instagram API configuration
// Note: requires Instagram Graph API or another method to fetch posts
// This provides a basic scaffold for future integration with the real Instagram API
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_USER_ID = process.env.INSTAGRAM_USER_ID;

interface InstagramPost {
  id: string;
  // Base fields (backward compatible)
  permalink: string;
  media_url: string;
  caption?: string;
  username: string;
  timestamp: string;
  vote_count: number;
  // Primary fields returned by the API
  input_url?: string | null;
  post_type?: string | null;
  type?: string | null;
  short_code?: string | null;
  url?: string | null;
  // Media info
  display_url?: string | null;
  video_url?: string | null;
  dimensions_height?: number | null;
  dimensions_width?: number | null;
  // Engagement data
  likes_count?: number | null;
  comments_count?: number | null;
  video_play_count?: number | null;
  ig_play_count?: number | null;
  fb_like_count?: number | null;
  fb_play_count?: number | null;
  video_duration?: number | null;
  // User info
  owner_full_name?: string | null;
  owner_username?: string | null;
  owner_id?: string | null;
  // Other info
  first_comment?: string | null;
  location_name?: string | null;
  product_type?: string | null;
  // Arrays and complex objects
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
 * Fetch posts with a specific hashtag from the Instagram Graph API
 * Note: Instagram Graph API requires Hashtag Search to fetch posts,
 * which needs an Instagram Business Account and the appropriate permissions
 */
async function fetchInstagramPosts(): Promise<InstagramPost[]> {
  // TODO: Integrate the real Instagram API
  // Example structure — actual implementation needs:
  // 1. Use Instagram Graph API Hashtag Search
  // 2. Search for #taiwandigitalfest
  // 3. Fetch post data

  // Returning empty array for now; should fetch from Instagram API
  // or use a third-party service such as RapidAPI's Instagram scraper
  
  if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_USER_ID) {
    console.warn('[Award API] Instagram credentials not configured. Returning empty posts.');
    return [];
  }

  try {
    // Example: fetch posts via Instagram Graph API
    // Note: actual implementation should follow the latest Instagram API docs
    // const response = await fetch(
    //   `https://graph.instagram.com/${INSTAGRAM_USER_ID}/media?fields=id,caption,media_type,media_url,permalink,timestamp,username&access_token=${INSTAGRAM_ACCESS_TOKEN}`
    // );
    // const data = await response.json();
    
    // Fetch vote counts from the database
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

    // Should process data fetched from the Instagram API
    // and merge vote counts
    return [];
  } catch (error) {
    console.error('[Award API] Failed to fetch Instagram posts:', error);
    return [];
  }
}

/**
 * Fetch stored posts from the database (if posts are stored in the DB)
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

    // Fetch vote count for each post
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
 * Fetch data from the ig_posts table (preferred source)
 */
async function getIgPosts(): Promise<InstagramPost[]> {
  if (!supabaseServer) {
    console.warn('[Award API] Supabase client not configured for getIgPosts');
    return [];
  }

  try {
    // Fetch all data, then sort by data.timestamp
    let { data: igPosts, error: igError } = await supabaseServer
      .from('ig_posts')
      .select('*');

    if (igError) {
      console.error('[Award API] Error fetching ig_posts:', igError);
      return [];
    }

    // Sort in memory by data.timestamp
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
        
        // Descending order (newest first)
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
 * Process ig_posts data and convert to InstagramPost format
 */
async function processIgPosts(igPosts: any[]): Promise<InstagramPost[]> {
  // Fetch vote count for each post
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

  // Process ig_posts data format
  return igPosts.map((post: any): InstagramPost => {
    // Process JSONB data
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
    
    // Prefer data.timestamp, fall back to other fields
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
          // Parse failed; continue with other fallbacks
        }
      }
    }
    
    // If data.timestamp is missing, use other fallbacks (always return a string)
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
    // Prefer fetching all data from ig_posts table
    let posts = await getIgPosts();

    // If ig_posts table is empty, try award_posts table
    if (posts.length === 0) {
      posts = await getStoredPosts();
    }

    // If no posts in database, try fetching from Instagram API
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
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
