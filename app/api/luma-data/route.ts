import { NextRequest, NextResponse } from 'next/server';
import { buildScheduleFromEntries, type LumaApiEntry, type CalendarEvent } from '@/lib/lumaSchedule';
import { getSpeakersFromEntries, type SpeakerGrouped } from '@/lib/lumaSpeakers';
import eventLocations from '@/data/event-locations.json';
import { enforceRateLimit } from '@/lib/rateLimitResponse';

const LUMA_CALENDAR_BASE =
  'https://api2.luma.com/calendar/get-items?calendar_api_id=cal-S2KwfjOEzcZl8E8&pagination_limit=100';

// Luma's `future`/`all` periods drop events the moment they start, so the
// calendar empties out during the festival itself. Fetch upcoming + past in
// parallel and dedupe so already-started/finished events stay visible.
const LUMA_PERIODS: ReadonlyArray<'future' | 'past'> = ['future', 'past'];

const FETCH_OPTIONS = {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  next:
    process.env.NODE_ENV === 'development'
      ? { revalidate: 0 }
      : { revalidate: 3600 },
};

async function fetchEntriesForPeriod(period: 'future' | 'past'): Promise<LumaApiEntry[]> {
  const res = await fetch(`${LUMA_CALENDAR_BASE}&period=${period}`, FETCH_OPTIONS);
  if (!res.ok) {
    throw new Error(`Luma calendar (${period}) failed: ${res.statusText}`);
  }
  const data = (await res.json()) as { entries?: LumaApiEntry[] };
  return data.entries ?? [];
}

/**
 * Single calendar fetch: returns both schedule events and speakers
 * so the frontend can avoid duplicate requests (EventsSection + TeamSection).
 */
export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, { key: 'luma-data', limit: 120, windowSeconds: 60 });
  if (rl) return rl;

  try {
    const periodResults = await Promise.all(LUMA_PERIODS.map(fetchEntriesForPeriod));
    const byApiId = new Map<string, LumaApiEntry>();
    for (const list of periodResults) {
      for (const entry of list) {
        const apiId = entry?.event?.api_id;
        if (typeof apiId === 'string' && apiId.length > 0) {
          byApiId.set(apiId, entry);
        }
      }
    }
    const entries: LumaApiEntry[] = [...byApiId.values()];

    const events = buildScheduleFromEntries(entries);

    // Merge geocoded coordinates from static cache
    const locCache = eventLocations as Record<string, { lat: number; lng: number }>;

    // Title/keyword-based fallback for events without placeId or geo coords
    const TITLE_LOCATION_FALLBACKS: Array<{ match: (t: string) => boolean; lat: number; lng: number }> = [
      { match: (t) => /\btaitung\b/i.test(t) || /台東/i.test(t), lat: 22.7560447, lng: 121.1456538 },
      { match: (t) => /\bhualien\b/i.test(t) || /花蓮/i.test(t), lat: 23.9821, lng: 121.6068 },
      { match: (t) => /kasavakan|song school|書屋/i.test(t), lat: 22.7560447, lng: 121.1456538 },
    ];

    const eventsWithCoords: CalendarEvent[] = events.map((event) => {
      if (event.latitude != null && event.longitude != null) return event;
      if (event.placeId && locCache[event.placeId]) {
        return {
          ...event,
          latitude: locCache[event.placeId].lat,
          longitude: locCache[event.placeId].lng,
        };
      }
      // Title-based fallback for events missing both geo and placeId
      const titleFallback = TITLE_LOCATION_FALLBACKS.find((f) => f.match(event.title));
      if (titleFallback) {
        return { ...event, latitude: titleFallback.lat, longitude: titleFallback.lng };
      }
      return event;
    });

    const speakers = getSpeakersFromEntries(entries);

    return NextResponse.json({ events: eventsWithCoords, speakers });
  } catch (error) {
    console.error('Error fetching Luma data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Luma data',
        events: [],
        speakers: [] as SpeakerGrouped[],
      },
      { status: 500 }
    );
  }
}
