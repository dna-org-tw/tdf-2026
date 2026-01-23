import { NextResponse } from 'next/server';

const LUMA_EVENT_URL = 'https://luma.com/bghtt5zv';

interface LumaHost {
  name: string | null;
  api_id: string;
  website: string | null;
  timezone: string;
  username: string | null;
  bio_short: string | null;
  avatar_url: string;
  is_verified: boolean;
  tiktok_handle: string | null;
  last_online_at: string | null;
  twitter_handle: string | null;
  youtube_handle: string | null;
  linkedin_handle: string | null;
  instagram_handle: string | null;
}

interface Partner {
  name: string;
  logo?: string;
  instagram?: string;
  website?: string;
  youtube?: string;
  twitter?: string;
  linkedin?: string;
  tiktok?: string;
}

export async function GET() {
  try {
    // Fetch Luma event page
    const response = await fetch(LUMA_EVENT_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Luma page: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Extract __NEXT_DATA__ from HTML
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    
    if (!nextDataMatch) {
      throw new Error('Could not find __NEXT_DATA__ in HTML');
    }

    let nextData;
    try {
      nextData = JSON.parse(nextDataMatch[1]);
    } catch {
      throw new Error('Failed to parse __NEXT_DATA__ JSON');
    }

    // Extract hosts from pageProps.initialData.data.hosts
    let hosts: LumaHost[] = [];
    
    // Primary path: pageProps.initialData.data.hosts
    if (nextData.props?.pageProps?.initialData?.data?.hosts) {
      hosts = nextData.props.pageProps.initialData.data.hosts;
    } 
    // Fallback paths
    else if (nextData.props?.pageProps?.hosts) {
      hosts = nextData.props.pageProps.hosts;
    } else if (nextData.props?.pageProps?.event?.hosts) {
      hosts = nextData.props.pageProps.event.hosts;
    } else if (nextData.props?.pageProps?.data?.hosts) {
      hosts = nextData.props.pageProps.data.hosts;
    } else if (nextData.query?.hosts) {
      hosts = nextData.query.hosts;
    } else {
      // Try to find hosts in the entire props structure
      const findHosts = (obj: unknown): LumaHost[] | null => {
        if (Array.isArray(obj) && obj.length > 0 && obj[0]?.api_id) {
          return obj;
        }
        if (typeof obj === 'object' && obj !== null) {
          const record = obj as Record<string, unknown>;
          for (const key in record) {
            if (key === 'hosts' && Array.isArray(record[key])) {
              return record[key] as LumaHost[];
            }
            const result = findHosts(record[key]);
            if (result) return result;
          }
        }
        return null;
      };
      
      const foundHosts = findHosts(nextData.props);
      if (foundHosts) {
        hosts = foundHosts;
      }
    }

    if (!hosts || hosts.length === 0) {
      console.warn('No hosts found in __NEXT_DATA__');
      return NextResponse.json({ partners: [] });
    }

    // Filter out hosts without names and map to Partner format
    const partners: Partner[] = hosts
      .filter((host: LumaHost) => host.name && host.name.trim().length > 0)
      .map((host: LumaHost) => {
        const partner: Partner = {
          name: host.name!,
        };

        // Add avatar/logo
        if (host.avatar_url) {
          partner.logo = host.avatar_url;
        }

        // Add website
        if (host.website) {
          partner.website = host.website;
        }

        // Add social media links based on handles
        if (host.instagram_handle) {
          partner.instagram = `https://instagram.com/${host.instagram_handle}`;
        }

        if (host.youtube_handle) {
          partner.youtube = `https://youtube.com/@${host.youtube_handle}`;
        }

        if (host.twitter_handle) {
          partner.twitter = `https://twitter.com/${host.twitter_handle}`;
        }

        if (host.linkedin_handle) {
          partner.linkedin = `https://linkedin.com/in/${host.linkedin_handle}`;
        }

        if (host.tiktok_handle) {
          partner.tiktok = `https://tiktok.com/@${host.tiktok_handle}`;
        }

        return partner;
      });

    // Remove duplicates by name (case-insensitive)
    const uniquePartners: Partner[] = [];
    const seenNames = new Set<string>();
    
    for (const partner of partners) {
      const normalizedName = partner.name.trim().toLowerCase();
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        uniquePartners.push(partner);
      }
    }

    console.log(`Found ${uniquePartners.length} unique partners:`, uniquePartners.map(p => p.name));

    return NextResponse.json({ partners: uniquePartners });
  } catch (error) {
    console.error('Error fetching Luma partners:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner data', partners: [] },
      { status: 500 }
    );
  }
}
