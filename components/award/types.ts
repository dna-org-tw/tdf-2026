export interface TaggedUser {
  id: string;
  username: string;
  full_name: string;
  is_private?: boolean;
  is_verified?: boolean;
  profile_pic_url?: string;
}

export interface ChildPost {
  id: string;
  type: string;
  displayUrl?: string;
  images?: string[];
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  timestamp?: string;
  taggedUsers?: TaggedUser[];
  dimensionsWidth?: number;
  dimensionsHeight?: number;
}

export interface CoauthorProducer {
  id: string;
  username: string;
  full_name: string;
  is_private?: boolean;
  is_verified?: boolean;
  profile_pic_url?: string;
}

export interface InstagramPost {
  id: string;
  // Basic fields (backward compatible)
  permalink?: string;
  media_url?: string;
  caption?: string;
  username?: string;
  timestamp: string;
  vote_count?: number;
  has_voted?: boolean;
  // Primary fields from API response
  input_url?: string | null;
  post_type?: string | null;
  type?: string | null;
  short_code?: string | null;
  url?: string | null;
  error?: string | null;
  // Media info
  display_url?: string | null;
  displayUrl?: string | null;
  video_url?: string | null;
  images?: string[] | null;
  dimensions_height?: number | null;
  dimensionsWidth?: number | null;
  dimensions_width?: number | null;
  dimensionsHeight?: number | null;
  // Engagement data
  likes_count?: number | null;
  likesCount?: number | null;
  comments_count?: number | null;
  commentsCount?: number | null;
  video_play_count?: number | null;
  videoPlayCount?: number | null;
  ig_play_count?: number | null;
  fb_like_count?: number | null;
  fb_play_count?: number | null;
  video_duration?: number | null;
  // User info
  owner_full_name?: string | null;
  ownerFullName?: string | null;
  owner_username?: string | null;
  ownerUsername?: string | null;
  owner_id?: string | null;
  ownerId?: string | null;
  // Other info
  first_comment?: string | null;
  location_name?: string | null;
  product_type?: string | null;
  productType?: string | null;
  // Arrays and complex objects
  hashtags?: string[] | null;
  mentions?: string[] | null;
  latest_comments?: unknown[] | null;
  latestComments?: unknown[] | null;
  child_posts?: ChildPost[] | null;
  childPosts?: ChildPost[] | null;
  tagged_users?: TaggedUser[] | null;
  taggedUsers?: TaggedUser[] | null;
  music_info?: unknown | null;
  musicInfo?: unknown | null;
  coauthor_producers?: CoauthorProducer[] | null;
  coauthorProducers?: CoauthorProducer[] | null;
}
