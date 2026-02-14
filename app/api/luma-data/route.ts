import { NextResponse } from 'next/server';
import { buildScheduleFromEntries, type LumaApiEntry } from '@/lib/lumaSchedule';
import {
  getSpeakersFromEventList,
  type SpeakerGrouped,
  type SpeakerEventInput,
} from '@/lib/lumaSpeakers';

const LUMA_API_URL =
  'https://api2.luma.com/calendar/get-items?calendar_api_id=cal-S2KwfjOEzcZl8E8&pagination_limit=100&period=future';

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

/**
 * Single calendar fetch: returns both schedule events and speakers
 * so the frontend can avoid duplicate requests (EventsSection + TeamSection).
 */
export async function GET() {
  try {
    const calRes = await fetch(LUMA_API_URL, FETCH_OPTIONS);
    if (!calRes.ok) {
      throw new Error(`Luma calendar failed: ${calRes.statusText}`);
    }

    const data = (await calRes.json()) as { entries?: LumaApiEntry[] };
    const entries: LumaApiEntry[] = data.entries || [];

    const events = buildScheduleFromEntries(entries);

    const speakerEventList: SpeakerEventInput[] = entries
      .filter((e) => e.event?.name && e.event?.url)
      .map((e) => ({
        slug: e.event.url,
        name: e.event.name,
        url: e.event.url.startsWith('http') ? e.event.url : `https://lu.ma/${e.event.url}`,
      }));

    const seen = new Set<string>();
    const uniqueSpeakerEvents = speakerEventList.filter((ev) => {
      const key = `${ev.slug}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const speakers = await getSpeakersFromEventList(uniqueSpeakerEvents, {
      maxEvents: 50,
    });

    return NextResponse.json({ events, speakers });
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
