import { NextResponse } from 'next/server';
import { buildScheduleFromEntries, type LumaApiEntry } from '@/lib/lumaSchedule';
import { getSpeakersFromEntries, type SpeakerGrouped } from '@/lib/lumaSpeakers';

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

    const speakers = getSpeakersFromEntries(entries);

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
