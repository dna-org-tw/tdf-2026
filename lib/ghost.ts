const GHOST_URL = process.env.GHOST_URL;
const GHOST_API_KEY = process.env.GHOST_CONTENT_API_KEY;
const GHOST_API_VERSION = 'v5.0';

export interface GhostPost {
  id: string;
  uuid: string;
  title: string;
  slug: string;
  html: string;
  excerpt: string;
  feature_image: string | null;
  feature_image_alt: string | null;
  feature_image_caption: string | null;
  published_at: string;
  updated_at: string;
  reading_time: number;
  tags: GhostTag[];
  primary_tag: GhostTag | null;
  authors: GhostAuthor[];
  primary_author: GhostAuthor;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  og_title: string | null;
  og_description: string | null;
  twitter_image: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
}

export interface GhostTag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  feature_image: string | null;
}

export interface GhostAuthor {
  id: string;
  name: string;
  slug: string;
  profile_image: string | null;
  bio: string | null;
  url: string;
}

export interface GhostPagination {
  page: number;
  limit: number;
  pages: number;
  total: number;
  next: number | null;
  prev: number | null;
}

async function ghostFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<{ data: T[]; pagination: GhostPagination }> {
  if (!GHOST_URL || !GHOST_API_KEY) {
    return {
      data: [],
      pagination: { page: 1, limit: 15, pages: 1, total: 0, next: null, prev: null },
    };
  }

  const url = new URL(`/ghost/api/content/${endpoint}/`, GHOST_URL);
  url.searchParams.set('key', GHOST_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    next: { tags: ['ghost-posts'], revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Ghost API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  // Ghost API wraps responses in a resource key (e.g. { posts: [...], meta: {...} })
  const resourceKey = endpoint.split('/')[0]; // 'posts' from 'posts' or 'posts/slug/xxx'
  return {
    data: json[resourceKey] || [],
    pagination: json.meta?.pagination || {
      page: 1,
      limit: 15,
      pages: 1,
      total: 0,
      next: null,
      prev: null,
    },
  };
}

const EMPTY_PAGINATION: GhostPagination = {
  page: 1, limit: 12, pages: 1, total: 0, next: null, prev: null,
};

export async function getPosts(
  page = 1,
  limit = 12
): Promise<{ posts: GhostPost[]; pagination: GhostPagination }> {
  try {
    const { data, pagination } = await ghostFetch<GhostPost>('posts', {
      page: String(page),
      limit: String(limit),
      include: 'tags,authors',
      fields:
        'id,uuid,title,slug,excerpt,feature_image,feature_image_alt,published_at,updated_at,reading_time',
    });
    return { posts: data, pagination };
  } catch {
    return { posts: [], pagination: EMPTY_PAGINATION };
  }
}

export async function getPostBySlug(slug: string): Promise<GhostPost | null> {
  try {
    const { data } = await ghostFetch<GhostPost>(`posts/slug/${slug}`, {
      include: 'tags,authors',
    });
    return data[0] || null;
  } catch {
    return null;
  }
}

export async function getAllPostSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data, pagination } = await ghostFetch<GhostPost>('posts', {
      page: String(page),
      limit: '100',
      fields: 'slug',
    });
    slugs.push(...data.map((p) => p.slug));
    hasMore = pagination.next !== null;
    page++;
  }

  return slugs;
}
