import { NextResponse } from 'next/server';
import * as ical from 'node-ical';

const ICS_URL = 'https://calendar.google.com/calendar/ical/c_c626d6889c76bd662c43a7b0b0b6573abb385a4e293fd54c35f260cfd793b4cf%40group.calendar.google.com/public/basic.ics';

export async function GET() {
  try {
    // Fetch ICS data from Google Calendar
    const response = await fetch(ICS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch ICS: ${response.statusText}`);
    }
    
    const icsText = await response.text();
    
    // Parse ICS data
    const events = ical.parseICS(icsText);
    
    // Format dates as YYYY-MM-DD
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Transform events to our format
    interface ICalEvent {
      type?: string;
      start?: Date | string;
      end?: Date | string;
      summary?: string;
      location?: string;
      description?: string;
    }

    const calendarEvents = Object.values(events)
      .filter((event) => {
        const e = event as unknown as ICalEvent;
        return e.type === 'VEVENT';
      })
      .map((event) => {
        const e = event as unknown as ICalEvent;
        const startDate = e.start ? new Date(e.start) : null;
        let endDate = e.end ? new Date(e.end) : null;
        
        // Check if it's an all-day event (before modifying endDate)
        const isAllDay = startDate && 
                        endDate &&
                        startDate.getHours() === 0 && 
                        startDate.getMinutes() === 0 &&
                        endDate.getHours() === 0 && 
                        endDate.getMinutes() === 0;
        
        // ICS endDate is exclusive, so for all-day events we subtract one day
        // For regular events, we keep the end date as is
        if (isAllDay && endDate) {
          // Subtract one day for all-day events (end is exclusive)
          endDate = new Date(endDate);
          endDate.setDate(endDate.getDate() - 1);
        }
        
        // Extract eligibility tags from title (#explorer, #contributor, #backer)
        const eligibilityTags: string[] = [];
        const validTags = ['#explorer', '#contributor', '#backer'];
        let cleanTitle = e.summary || 'Untitled Event';
        
        validTags.forEach(tag => {
          // Match tag with optional space before/after
          const regex = new RegExp(`\\s*${tag}\\s*`, 'gi');
          if (regex.test(cleanTitle)) {
            eligibilityTags.push(tag.toLowerCase());
            cleanTitle = cleanTitle.replace(regex, ' ').trim();
          }
        });
        
        // Clean up extra spaces
        cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
        
        return {
          title: cleanTitle,
          location: e.location || '',
          description: e.description || '',
          startDate: startDate ? formatDate(startDate) : null,
          endDate: endDate ? formatDate(endDate) : null,
          startTime: startDate && !isAllDay ? startDate.toISOString() : null,
          eligibility: eligibilityTags,
        };
      })
      .filter((event) => {
        // Only include events in May 2026
        if (!event.startDate) return false;
        const isInMay = event.startDate.startsWith('2026-05') || 
                       (event.endDate && event.endDate.startsWith('2026-05'));
        return isInMay;
      });
    
    return NextResponse.json({ events: calendarEvents });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar data', events: [] },
      { status: 500 }
    );
  }
}
