import { NextResponse } from 'next/server';

const LUMA_URL = 'https://luma.com/taiwan-digital-nomad-hub?k=c';

interface LumaEvent {
  title: string;
  url: string;
  date?: string;
  location?: string;
  description?: string;
  imageUrl?: string;
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
    const events: LumaEvent[] = [];
    
    // Method 1: Look for event links in the HTML
    // Luma typically uses links like /events/[slug] or lu.ma/[slug]
    const eventLinkPatterns = [
      /href=["'](https?:\/\/lu\.ma\/[^"']+)["']/gi,
      /href=["'](https?:\/\/luma\.com\/[^"']+)["']/gi,
      /href=["'](\/[^"']*events?[^"']*)["']/gi,
    ];
    
    const foundUrls = new Set<string>();
    
    for (const pattern of eventLinkPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let url = match[1];
        if (url.startsWith('/')) {
          url = `https://luma.com${url}`;
        }
        if (url.includes('event') || url.includes('lu.ma') || url.includes('luma.com')) {
          foundUrls.add(url);
        }
      }
    }
    
    // Method 2: Look for event data in script tags (React/Next.js apps often embed data)
    const scriptTagRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    
    while ((scriptMatch = scriptTagRegex.exec(html)) !== null) {
      const scriptContent = scriptMatch[1];
      
      // Look for JSON data that might contain event information
      try {
        // Try to find JSON objects with event-like structure
        const jsonMatches = scriptContent.match(/\{[^{}]*"title"[^{}]*\}/g) || 
                           scriptContent.match(/\{[^{}]*"name"[^{}]*\}/g);
        
        if (jsonMatches) {
          for (const jsonStr of jsonMatches) {
            try {
              const data = JSON.parse(jsonStr);
              if (data.title || data.name) {
                const url = data.url || data.slug || data.id;
                if (url && !foundUrls.has(url)) {
                  foundUrls.add(url.startsWith('http') ? url : `https://lu.ma/${url}`);
                }
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
    
    // Method 3: Parse HTML structure for event cards
    // Look for common event card patterns
    const eventCardPatterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      /<div[^>]*class=["'][^"']*event[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    ];
    
    for (const pattern of eventCardPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const cardHtml = match[1];
        
        // Extract title
        const titleMatch = cardHtml.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i) ||
                          cardHtml.match(/<a[^>]*>([^<]+)<\/a>/i);
        
        // Extract URL
        const urlMatch = cardHtml.match(/href=["']([^"']+)["']/i);
        
        if (titleMatch && urlMatch) {
          let url = urlMatch[1];
          if (url.startsWith('/')) {
            url = `https://luma.com${url}`;
          } else if (!url.startsWith('http')) {
            url = `https://lu.ma/${url}`;
          }
          
          if (!foundUrls.has(url)) {
            foundUrls.add(url);
            
            // Extract location and date if available
            const locationMatch = cardHtml.match(/(?:location|地點|地點：)[^>]*>([^<]+)</i);
            const dateMatch = cardHtml.match(/(?:date|日期|日期：)[^>]*>([^<]+)</i);
            
            events.push({
              title: titleMatch[1].trim(),
              url: url,
              location: locationMatch ? locationMatch[1].trim() : undefined,
              date: dateMatch ? dateMatch[1].trim() : undefined,
            });
          }
        }
      }
    }
    
    // Method 4: Look for structured data (JSON-LD)
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
              const url = data.url || data['@id'] || data.slug;
              if (url && !events.some(e => e.url === url)) {
                events.push({
                  title: data.name || data.title || '',
                  url: url.startsWith('http') ? url : `https://lu.ma/${url}`,
                  date: data.startDate || data.date || undefined,
                  location: data.location?.name || data.location || undefined,
                  description: data.description || undefined,
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
    
    // Fallback: Use known events from the website if parsing fails
    if (events.length === 0) {
      events.push(
        {
          title: 'Taiwan Digital Fest 2026',
          url: 'https://lu.ma/taiwan-digital-fest-2026',
          location: '臺東森林公園',
        },
        {
          title: 'Nomad Heartline',
          url: 'https://lu.ma/nomad-heartline',
          location: '臺東美術館',
        }
      );
    }
    
    // Filter and clean events
    const cleanedEvents = events
      .filter(event => event.title && event.url)
      .map(event => ({
        ...event,
        url: event.url.startsWith('http') ? event.url : `https://luma.com${event.url}`,
      }))
      // Remove duplicates
      .filter((event, index, self) => 
        index === self.findIndex(e => e.url === event.url)
      )
      .slice(0, 20); // Limit to 20 events
    
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
