import { InstagramPost } from './types';

// Get post thumbnail image
export const getPostImage = (post: InstagramPost): string => {
  if (post.media_url) return post.media_url;
  if (post.display_url) return post.display_url;
  if (post.displayUrl) return post.displayUrl;
  if (post.images && post.images.length > 0) return post.images[0];
  return '';
};

// Get post permalink
export const getPostLink = (post: InstagramPost): string => {
  if (post.permalink) return post.permalink;
  if (post.url) return post.url;
  if (post.short_code) return `https://www.instagram.com/p/${post.short_code}/`;
  return '#';
};

// Get post username
export const getPostUsername = (post: InstagramPost): string => {
  return post.username || post.owner_username || post.ownerUsername || '';
};

// Format number
export const formatNumber = (num: number | null | undefined): string => {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Format date
export const formatDate = (timestamp: string, lang: string = 'en'): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
};
