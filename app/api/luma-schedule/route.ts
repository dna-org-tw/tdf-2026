import { NextResponse } from 'next/server';

const LUMA_URL = 'https://luma.com/taiwandigitalfest';

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
  url?: string;
  tickets?: TicketInfo;
}

export async function GET() {
  try {
    // Fetch HTML from Luma website
    const response = await fetch(LUMA_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: process.env.NODE_ENV === 'development' 
        ? { revalidate: 0 } // No cache in development
        : { revalidate: 3600 }, // Cache for 1 hour in production
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Luma page: ${response.statusText}`);
    }

    const html = await response.text();
    const events: CalendarEvent[] = [];

    // Parse events from HTML
    // Method 1: Look for structured data (JSON-LD)
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let jsonLdMatch;

    while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        const processJsonData = (data: any) => {
          if (Array.isArray(data)) {
            data.forEach(processJsonData);
          } else if (data && typeof data === 'object') {
            if (data['@type'] === 'Event' || data.type === 'Event') {
              const startDate = data.startDate || data.dateStart || data.date;
              const endDate = data.endDate || data.dateEnd || null;
              const startTime = data.startTime || (startDate && startDate.includes('T') ? startDate : null);
              
              // Extract URL
              let eventUrl = data.url || data['@id'] || data.slug || '';
              if (eventUrl && !eventUrl.startsWith('http')) {
                if (eventUrl.startsWith('/')) {
                  eventUrl = `https://luma.com${eventUrl}`;
                } else {
                  eventUrl = `https://lu.ma/${eventUrl}`;
                }
              }
              
              // Extract eligibility tags from title/description
              const eligibilityTags: string[] = [];
              const validTags = ['#explorer', '#contributor', '#backer'];
              let cleanTitle = data.name || data.title || '';
              
              validTags.forEach(tag => {
                const regex = new RegExp(`\\s*${tag}\\s*`, 'gi');
                if (regex.test(cleanTitle)) {
                  eligibilityTags.push(tag.toLowerCase());
                  cleanTitle = cleanTitle.replace(regex, ' ').trim();
                }
              });

              // Format dates to YYYY-MM-DD
              let formattedStartDate = '';
              let formattedEndDate = null;
              let formattedStartTime = null;

              if (startDate) {
                const date = new Date(startDate);
                if (!isNaN(date.getTime())) {
                  formattedStartDate = formatDate(date);
                  // Check if it has time component
                  if (startDate.includes('T')) {
                    formattedStartTime = date.toISOString();
                  }
                }
              }

              if (endDate) {
                const date = new Date(endDate);
                if (!isNaN(date.getTime())) {
                  formattedEndDate = formatDate(date);
                }
              }

              if (formattedStartDate && formattedStartDate.startsWith('2026-05')) {
                events.push({
                  title: cleanTitle.trim() || 'Untitled Event',
                  location: data.location?.name || data.location || '',
                  description: data.description || '',
                  startDate: formattedStartDate,
                  endDate: formattedEndDate,
                  startTime: formattedStartTime,
                  eligibility: eligibilityTags.length > 0 ? eligibilityTags : undefined,
                  url: eventUrl || undefined,
                });
              }
            }
            // Recursively process nested objects
            Object.values(data).forEach(processJsonData);
          }
        };
        processJsonData(jsonData);
      } catch (e) {
        // Skip invalid JSON
      }
    }

    // Method 2: Parse HTML structure for event cards
    // Look for event cards with date information
    const eventCardPatterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      /<div[^>]*class=["'][^"']*event[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*data-testid=["']event[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    ];

    for (const pattern of eventCardPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const cardHtml = match[1];

        // Extract title
        const titleMatch = cardHtml.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i) ||
                          cardHtml.match(/<a[^>]*>([^<]+)<\/a>/i) ||
                          cardHtml.match(/data-title=["']([^"']+)["']/i);

        if (!titleMatch) continue;

        let title = titleMatch[1].trim();

        // Extract URL
        const urlMatch = cardHtml.match(/href=["']([^"']+)["']/i) ||
                        cardHtml.match(/data-url=["']([^"']+)["']/i);
        let eventUrl = '';
        if (urlMatch) {
          eventUrl = urlMatch[1].trim();
          if (eventUrl.startsWith('/')) {
            eventUrl = `https://luma.com${eventUrl}`;
          } else if (!eventUrl.startsWith('http')) {
            eventUrl = `https://lu.ma/${eventUrl}`;
          }
        }

        // Extract eligibility tags from title
        const eligibilityTags: string[] = [];
        const validTags = ['#explorer', '#contributor', '#backer'];
        
        validTags.forEach(tag => {
          const regex = new RegExp(`\\s*${tag}\\s*`, 'gi');
          if (regex.test(title)) {
            eligibilityTags.push(tag.toLowerCase());
            title = title.replace(regex, ' ').trim();
          }
        });

        // Extract date/time
        const dateMatch = cardHtml.match(/data-date=["']([^"']+)["']/i) ||
                         cardHtml.match(/(?:date|日期)[^>]*>([^<]+)</i) ||
                         cardHtml.match(/datetime=["']([^"']+)["']/i);

        // Extract location
        const locationMatch = cardHtml.match(/data-location=["']([^"']+)["']/i) ||
                             cardHtml.match(/(?:location|地點)[^>]*>([^<]+)</i);

        if (dateMatch) {
          try {
            const dateStr = dateMatch[1].trim();
            const date = new Date(dateStr);
            
            if (!isNaN(date.getTime())) {
              const formattedStartDate = formatDate(date);
              
              // Only include events in May 2026
              if (formattedStartDate.startsWith('2026-05')) {
                const formattedStartTime = dateStr.includes('T') ? date.toISOString() : null;
                
                events.push({
                  title: title,
                  location: locationMatch ? locationMatch[1].trim() : '',
                  description: '',
                  startDate: formattedStartDate,
                  endDate: null,
                  startTime: formattedStartTime,
                  eligibility: eligibilityTags.length > 0 ? eligibilityTags : undefined,
                  url: eventUrl || undefined,
                });
              }
            }
          } catch (e) {
            // Skip invalid date
          }
        }
      }
    }

    // Method 3: Look for event data in script tags
    const scriptTagRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;

    while ((scriptMatch = scriptTagRegex.exec(html)) !== null) {
      const scriptContent = scriptMatch[1];

      // Look for event arrays or objects
      try {
        // Try to find event data structures
        const eventDataPatterns = [
          /events\s*[:=]\s*(\[[\s\S]*?\])/i,
          /eventList\s*[:=]\s*(\[[\s\S]*?\])/i,
          /"events"\s*:\s*(\[[\s\S]*?\])/i,
        ];

        for (const pattern of eventDataPatterns) {
          const match = scriptContent.match(pattern);
          if (match) {
            try {
              const eventData = JSON.parse(match[1]);
              if (Array.isArray(eventData)) {
                eventData.forEach((event: any) => {
                  if (event.title || event.name) {
                    const startDate = event.startDate || event.date || event.start || event.dateTime;
                    if (startDate) {
                      try {
                        const date = new Date(startDate);
                        if (!isNaN(date.getTime())) {
                          const formattedStartDate = formatDate(date);
                          
                          if (formattedStartDate.startsWith('2026-05')) {
                            // Extract eligibility tags
                            const eligibilityTags: string[] = [];
                            const validTags = ['#explorer', '#contributor', '#backer'];
                            let cleanTitle = event.title || event.name || 'Untitled Event';
                            
                            validTags.forEach(tag => {
                              const regex = new RegExp(`\\s*${tag}\\s*`, 'gi');
                              if (regex.test(cleanTitle)) {
                                eligibilityTags.push(tag.toLowerCase());
                                cleanTitle = cleanTitle.replace(regex, ' ').trim();
                              }
                            });

                            // Extract URL
                            let eventUrl = event.url || event.slug || event.id || '';
                            if (eventUrl && !eventUrl.startsWith('http')) {
                              if (eventUrl.startsWith('/')) {
                                eventUrl = `https://luma.com${eventUrl}`;
                              } else {
                                eventUrl = `https://lu.ma/${eventUrl}`;
                              }
                            }

                            events.push({
                              title: cleanTitle,
                              location: event.location || event.venue || '',
                              description: event.description || '',
                              startDate: formattedStartDate,
                              endDate: event.endDate ? formatDate(new Date(event.endDate)) : null,
                              startTime: startDate.includes('T') ? date.toISOString() : null,
                              eligibility: eligibilityTags.length > 0 ? eligibilityTags : undefined,
                              url: eventUrl || undefined,
                            });
                          }
                        }
                      } catch (e) {
                        // Skip invalid date
                      }
                    }
                  }
                });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      } catch (e) {
        // Continue searching
      }
    }

    // Remove duplicates based on title and startDate
    const uniqueEvents = events.filter((event, index, self) =>
      index === self.findIndex(e => 
        e.title === event.title && e.startDate === event.startDate
      )
    );

    // Fetch ticket information for each event (with URL)
    // Limit concurrent requests to avoid overwhelming the server
    const eventsWithTickets = await Promise.all(
      uniqueEvents.map(async (event) => {
        if (event.url) {
          const ticketInfo = await fetchTicketInfo(event.url);
          return { ...event, tickets: ticketInfo };
        }
        return event;
      })
    );

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
    console.error('Error fetching Luma schedule:', error);
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

// Helper function to fetch ticket information from an event page
async function fetchTicketInfo(eventUrl: string): Promise<TicketInfo | undefined> {
  if (!eventUrl) return undefined;
  
  try {
    const response = await fetch(eventUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: process.env.NODE_ENV === 'development' 
        ? { revalidate: 0 } // No cache in development
        : { revalidate: 3600 }, // Cache for 1 hour in production
    });

    if (!response.ok) {
      return undefined;
    }

    const html = await response.text();
    
    // Initialize ticket info
    const ticketInfo: TicketInfo = {
      follower: { free: false },
      explorer: { free: false },
      contributor: { free: false },
      backer: { free: false },
    };

    // Look for ticket pricing information in the HTML
    // Common patterns: "TDF Explorer", "Explorer", "免費" (free), "Free", price numbers, etc.
    
    // Method 1: Look for JSON-LD or structured data with ticket information
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let jsonLdMatch;
    
    while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        const processJsonData = (data: any) => {
          if (Array.isArray(data)) {
            data.forEach(processJsonData);
          } else if (data && typeof data === 'object') {
            // Look for offers or ticket information
            if (data.offers || data.tickets || data.price) {
              const offers = Array.isArray(data.offers) ? data.offers : (data.offers ? [data.offers] : []);
              const tickets = Array.isArray(data.tickets) ? data.tickets : (data.tickets ? [data.tickets] : []);
              
              [...offers, ...tickets].forEach((offer: any) => {
                const name = (offer.name || offer.title || offer.category || '').toLowerCase();
                const price = offer.price || offer.priceCurrency || 0;
                const isFree = price === 0 || price === '0' || price === '免費' || price === 'Free' || 
                             name.includes('free') || name.includes('免費');
                
                if (name.includes('follower')) {
                  ticketInfo.follower = { free: isFree, price: typeof price === 'number' ? price : undefined };
                } else if (name.includes('explorer')) {
                  ticketInfo.explorer = { free: isFree, price: typeof price === 'number' ? price : undefined };
                } else if (name.includes('contributor')) {
                  ticketInfo.contributor = { free: isFree, price: typeof price === 'number' ? price : undefined };
                } else if (name.includes('backer')) {
                  ticketInfo.backer = { free: isFree, price: typeof price === 'number' ? price : undefined };
                }
              });
            }
            // Recursively process nested objects
            Object.values(data).forEach(processJsonData);
          }
        };
        processJsonData(jsonData);
      } catch (e) {
        // Skip invalid JSON
      }
    }

    // Method 2: Look for ticket information in HTML text
    // Search for patterns like "TDF Explorer", "Explorer", "免費", "Free", etc.
    const ticketPatterns = [
      /(?:TDF\s+)?Follower[^<]*?(?:免費|Free|NT\$?\s*0|USD\s*\$?\s*0|免費|0\s*元)/gi,
      /(?:TDF\s+)?Explorer[^<]*?(?:免費|Free|NT\$?\s*0|USD\s*\$?\s*0|免費|0\s*元)/gi,
      /(?:TDF\s+)?Contributor[^<]*?(?:免費|Free|NT\$?\s*0|USD\s*\$?\s*0|免費|0\s*元)/gi,
      /(?:TDF\s+)?Backer[^<]*?(?:免費|Free|NT\$?\s*0|USD\s*\$?\s*0|免費|0\s*元)/gi,
    ];

    if (ticketPatterns[0].test(html)) {
      ticketInfo.follower.free = true;
    }
    if (ticketPatterns[1].test(html)) {
      ticketInfo.explorer.free = true;
    }
    if (ticketPatterns[2].test(html)) {
      ticketInfo.contributor.free = true;
    }
    if (ticketPatterns[3].test(html)) {
      ticketInfo.backer.free = true;
    }

    // Method 3: Look for ticket sections in HTML
    const ticketSectionRegex = /<div[^>]*class=["'][^"']*ticket[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
    let ticketSectionMatch;
    
    while ((ticketSectionMatch = ticketSectionRegex.exec(html)) !== null) {
      const sectionHtml = ticketSectionMatch[1].toLowerCase();
      const isFree = /(?:免費|free|NT\$?\s*0|USD\s*\$?\s*0|0\s*元)/i.test(sectionHtml);
      
      if (sectionHtml.includes('follower')) {
        ticketInfo.follower.free = isFree || ticketInfo.follower.free;
      } else if (sectionHtml.includes('explorer')) {
        ticketInfo.explorer.free = isFree || ticketInfo.explorer.free;
      } else if (sectionHtml.includes('contributor')) {
        ticketInfo.contributor.free = isFree || ticketInfo.contributor.free;
      } else if (sectionHtml.includes('backer')) {
        ticketInfo.backer.free = isFree || ticketInfo.backer.free;
      }
    }

    return ticketInfo;
  } catch (error) {
    console.error(`Error fetching ticket info for ${eventUrl}:`, error);
    return undefined;
  }
}
