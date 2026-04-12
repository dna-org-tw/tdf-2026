export interface TicketInfo {
  follower: { free: boolean; price?: number };
  explorer: { free: boolean; price?: number };
  contributor: { free: boolean; price?: number };
  backer: { free: boolean; price?: number };
}

export interface CalendarEvent {
  title: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string | null;
  startTime?: string | null;
  endTime?: string | null;
  eligibility?: string[];
  tags?: Array<{ name: string; color?: string }>;
  url?: string;
  tickets?: TicketInfo;
  imageUrl?: string;
  visibility?: string;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string;
}

/** Host from Luma calendar API (event host / speaker). */
export interface LumaApiHost {
  api_id: string;
  name: string | null;
  username?: string | null;
  avatar_url?: string | null;
  bio_short?: string | null;
  website?: string | null;
  twitter_handle?: string | null;
  youtube_handle?: string | null;
  linkedin_handle?: string | null;
  instagram_handle?: string | null;
  tiktok_handle?: string | null;
  [key: string]: unknown;
}

export interface LumaApiEntry {
  api_id: string;
  event: {
    api_id: string;
    name: string;
    start_at: string;
    end_at: string;
    visibility?: string;
    cover_url?: string;
    geo_address_info?: {
      full_address?: string;
      short_address?: string;
      place_id?: string;
      localized?: {
        'zh-TW'?: {
          full_address?: string;
          short_address?: string;
        };
      };
    };
    geo_latitude?: number | null;
    geo_longitude?: number | null;
    url: string;
  };
  start_at: string;
  hosts?: LumaApiHost[];
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

const TAIPEI_TZ = 'Asia/Taipei';

/** Extract year/month/day/hour/minute in Asia/Taipei timezone. */
export function toTaipeiParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TAIPEI_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)?.value || '0', 10);

  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value || '';
  const dayOfWeekMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  let hour = get('hour');
  // Intl hour12:false returns 24 for midnight in some engines
  if (hour === 24) hour = 0;

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    dayOfWeek: dayOfWeekMap[weekdayStr] ?? 0,
  };
}

function formatDate(date: Date): string {
  const { year, month, day } = toTaipeiParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Build schedule events from Luma API entries (May 2026 only, deduped, sorted).
 */
export function buildScheduleFromEntries(entries: LumaApiEntry[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  entries.forEach((entry) => {
    try {
      const event = entry.event;

      if (!event.name || !event.start_at) return;

      const startDate = new Date(event.start_at);
      if (isNaN(startDate.getTime())) return;

      const formattedStartDate = formatDate(startDate);

      if (!formattedStartDate.startsWith('2026-05')) return;

      const eligibilityTags: string[] = [];
      const validTags = ['#follower', '#explorer', '#contributor', '#backer', '#other'];
      let cleanTitle = event.name;

      // Extract eligibility from title hashtags
      validTags.forEach((tag) => {
        const regex = new RegExp(`\\s*${tag}\\s*`, 'gi');
        if (regex.test(cleanTitle)) {
          eligibilityTags.push(tag.toLowerCase());
          cleanTitle = cleanTitle.replace(regex, ' ').trim();
        }
      });

      // Also extract eligibility from entry.tags (Luma calendar tags)
      const ticketTagNames = ['follower', 'explorer', 'contributor', 'backer', 'other'];
      entry.tags?.forEach((tag) => {
        const name = tag.name.toLowerCase();
        if (ticketTagNames.includes(name)) {
          const hashTag = `#${name}`;
          if (!eligibilityTags.includes(hashTag)) {
            eligibilityTags.push(hashTag);
          }
        }
      });

      const eventTags =
        entry.tags?.map((tag) => ({
          name: tag.name.toLowerCase(),
          color: tag.color,
        })) || [];

      let eventUrl = event.url;
      if (eventUrl && !eventUrl.startsWith('http')) {
        eventUrl = `https://lu.ma/${eventUrl}`;
      }

      let formattedEndDate: string | null = null;
      if (event.end_at) {
        const endDateObj = new Date(event.end_at);
        if (!isNaN(endDateObj.getTime())) {
          formattedEndDate = formatDate(endDateObj);
        }
      }

      let formattedStartTime: string | null = null;
      if (event.start_at.includes('T')) {
        formattedStartTime = startDate.toISOString();
      }

      let formattedEndTime: string | null = null;
      if (event.end_at && event.end_at.includes('T')) {
        const endDateObj = new Date(event.end_at);
        if (!isNaN(endDateObj.getTime())) {
          formattedEndTime = endDateObj.toISOString();
        }
      }

      let location = '';
      if (event.geo_address_info) {
        const geoInfo = event.geo_address_info;
        location =
          geoInfo.localized?.['zh-TW']?.full_address ||
          geoInfo.localized?.['zh-TW']?.short_address ||
          geoInfo.full_address ||
          geoInfo.short_address ||
          '';
      }

      let ticketInfo: TicketInfo | undefined;
      if (entry.ticket_info) {
        const isFree = entry.ticket_info.is_free || false;
        const price = entry.ticket_info.price?.cents
          ? entry.ticket_info.price.cents / 100
          : undefined;
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
        endTime: formattedEndTime,
        eligibility: eligibilityTags.length > 0 ? eligibilityTags : undefined,
        tags: eventTags.length > 0 ? eventTags : undefined,
        url: eventUrl || undefined,
        imageUrl: event.cover_url,
        tickets: ticketInfo,
        visibility: event.visibility,
        latitude: event.geo_latitude ?? null,
        longitude: event.geo_longitude ?? null,
        placeId: event.geo_address_info?.place_id,
      });
    } catch {
      // Skip invalid event
    }
  });

  const uniqueEvents = events.filter(
    (event, index, self) =>
      index === self.findIndex((e) => e.title === event.title && e.startDate === event.startDate)
  );

  uniqueEvents.sort((a, b) => {
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

  return uniqueEvents;
}
