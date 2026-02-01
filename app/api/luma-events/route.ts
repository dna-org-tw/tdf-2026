import { NextResponse } from 'next/server';

const LUMA_API_URL = 'https://api2.luma.com/calendar/get-items?calendar_api_id=cal-S2KwfjOEzcZl8E8&pagination_limit=100&period=future';

interface LumaEvent {
  title: string;
  url: string;
  date?: string;
  location?: string;
  description?: string;
  imageUrl?: string;
}

interface LumaApiEntry {
  api_id: string;
  event: {
    api_id: string;
    name: string;
    start_at: string;
    end_at: string;
    cover_url?: string;
    geo_address_info?: {
      full_address?: string;
      short_address?: string;
      localized?: {
        'zh-TW'?: {
          full_address?: string;
          short_address?: string;
        };
      };
    };
    url: string;
  };
  start_at: string;
}

export async function GET() {
  try {
    // Fetch data from Luma API
    const response = await fetch(LUMA_API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: process.env.NODE_ENV === 'development' 
        ? { revalidate: 0 } // No cache in development
        : { revalidate: 3600 }, // Cache for 1 hour in production
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Luma API: ${response.statusText}`);
    }

    const data = await response.json();
    const entries: LumaApiEntry[] = data.entries || [];
    
    // Transform API data to our event format
    const events: LumaEvent[] = entries.map((entry) => {
      const event = entry.event;
      
      // Format date
      let dateStr: string | undefined;
      if (event.start_at) {
        try {
          const date = new Date(event.start_at);
          dateStr = date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        } catch (e) {
          // Skip invalid date
        }
      }
      
      // Get location (prefer localized Chinese address)
      let location: string | undefined;
      if (event.geo_address_info) {
        const geoInfo = event.geo_address_info;
        location = geoInfo.localized?.['zh-TW']?.full_address || 
                  geoInfo.localized?.['zh-TW']?.short_address ||
                  geoInfo.full_address || 
                  geoInfo.short_address;
      }
      
      // Format URL
      let eventUrl = event.url;
      if (eventUrl && !eventUrl.startsWith('http')) {
        eventUrl = `https://lu.ma/${eventUrl}`;
      }
      
      return {
        title: event.name || 'Untitled Event',
        url: eventUrl || '',
        date: dateStr,
        location: location,
        imageUrl: event.cover_url,
      };
    }).filter(event => event.title && event.url);
    
    // Remove duplicates based on URL
    const cleanedEvents = events.filter((event, index, self) => 
      index === self.findIndex(e => e.url === event.url)
    ).slice(0, 20); // Limit to 20 events
    
    return NextResponse.json({ events: cleanedEvents });
  } catch (error) {
    console.error('Error fetching Luma events:', error);
    // Return fallback events on error
    return NextResponse.json({
      events: [
        {
          title: 'Taiwan Digital Fest 2026',
          url: 'https://lu.ma/taiwan-digital-fest-2026',
          location: '臺東森林公園',
        },
        {
          title: 'Nomad Heartline',
          url: 'https://lu.ma/nomad-heartline',
          location: '臺東美術館',
        },
      ],
    });
  }
}
