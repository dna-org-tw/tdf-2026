import { NextResponse } from 'next/server';

const LUMA_API_URL = 'https://api2.luma.com/calendar/get-items?calendar_api_id=cal-S2KwfjOEzcZl8E8&pagination_limit=100&period=future';

interface TicketInfo {
  follower: { free: boolean; price?: number };
  explorer: { free: boolean; price?: number };
  contributor: { free: boolean; price?: number };
  backer: { free: boolean; price?: number };
}

interface CalendarEvent {
  title: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string | null;
  startTime?: string | null;
  eligibility?: string[];
  tags?: Array<{ name: string; color?: string }>;
  url?: string;
  tickets?: TicketInfo;
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
  ticket_info?: {
    price?: {
      cents: number;
      currency: string;
    };
    is_free?: boolean;
  };
  tags?: Array<{
    api_id: string;
    name: string;
    color?: string;
  }>;
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
      throw new Error(`Failed to fetch Luma calendar: ${response.statusText}`);
    }

    const data = await response.json();
    const entries: LumaApiEntry[] = data.entries || [];
    const events: CalendarEvent[] = [];

    // Transform API data to our event format
    entries.forEach((entry) => {
      try {
        const event = entry.event;
        
        if (!event.name || !event.start_at) return;

        const startDate = new Date(event.start_at);
        if (isNaN(startDate.getTime())) return;

        const formattedStartDate = formatDate(startDate);
            
            // Only include events in May 2026
            if (!formattedStartDate.startsWith('2026-05')) return;

            // Extract eligibility tags from title (fallback method)
            const eligibilityTags: string[] = [];
            const validTags = ['#follower', '#explorer', '#contributor', '#backer', '#other'];
        let cleanTitle = event.name;
            
            validTags.forEach(tag => {
              const regex = new RegExp(`\\s*${tag}\\s*`, 'gi');
              if (regex.test(cleanTitle)) {
                eligibilityTags.push(tag.toLowerCase());
                cleanTitle = cleanTitle.replace(regex, ' ').trim();
              }
            });

            // Extract tags from API response (preferred method)
            const eventTags = entry.tags?.map(tag => ({
              name: tag.name.toLowerCase(),
              color: tag.color
            })) || [];

            // Format URL
        let eventUrl = event.url;
            if (eventUrl && !eventUrl.startsWith('http')) {
                eventUrl = `https://lu.ma/${eventUrl}`;
            }

            // Format end date
            let formattedEndDate = null;
        if (event.end_at) {
          const endDateObj = new Date(event.end_at);
              if (!isNaN(endDateObj.getTime())) {
                formattedEndDate = formatDate(endDateObj);
              }
            }

        // Format start time (always include if start_at has time component)
            let formattedStartTime = null;
        if (event.start_at.includes('T')) {
          formattedStartTime = startDate.toISOString();
        }

        // Get location (prefer localized Chinese address)
        let location = '';
        if (event.geo_address_info) {
          const geoInfo = event.geo_address_info;
          location = geoInfo.localized?.['zh-TW']?.full_address || 
                    geoInfo.localized?.['zh-TW']?.short_address ||
                    geoInfo.full_address || 
                    geoInfo.short_address || '';
        }

        // Get ticket info from API response
        let ticketInfo: TicketInfo | undefined;
        if (entry.ticket_info) {
          const isFree = entry.ticket_info.is_free || false;
          const price = entry.ticket_info.price?.cents 
            ? entry.ticket_info.price.cents / 100 
            : undefined;
          
          // For now, we'll set all ticket tiers to the same price/free status
          // This can be enhanced if the API provides more detailed ticket tier information
          ticketInfo = {
            follower: { free: isFree, price: price },
            explorer: { free: isFree, price: price },
            contributor: { free: isFree, price: price },
            backer: { free: isFree, price: price },
          };
            }

            events.push({
              title: cleanTitle.trim() || 'Untitled Event',
              location: location,
          description: '',
              startDate: formattedStartDate,
              endDate: formattedEndDate,
              startTime: formattedStartTime,
              eligibility: eligibilityTags.length > 0 ? eligibilityTags : undefined,
              tags: eventTags.length > 0 ? eventTags : undefined,
              url: eventUrl || undefined,
          imageUrl: event.cover_url,
          tickets: ticketInfo,
            });
          } catch (e) {
            // Skip invalid event
      }
    });

    // Remove duplicates based on title and startDate
    const uniqueEvents = events.filter((event, index, self) =>
      index === self.findIndex(e => 
        e.title === event.title && e.startDate === event.startDate
      )
    );

    // Note: We no longer need to fetch ticket info separately since it's in the API response
    const eventsWithTickets = uniqueEvents;


    // Sort by startDate and startTime
    eventsWithTickets.sort((a, b) => {
      if (a.startDate !== b.startDate) {
        return a.startDate.localeCompare(b.startDate);
      }
      if (a.startTime && b.startTime) {
        return a.startTime.localeCompare(b.startTime);
      }
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return 0;
    });

    return NextResponse.json({ events: eventsWithTickets });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch schedule data', events: [] },
      { status: 500 }
    );
  }
}

// Helper function to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

