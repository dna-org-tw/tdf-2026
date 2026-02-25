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

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

      validTags.forEach((tag) => {
        const regex = new RegExp(`\\s*${tag}\\s*`, 'gi');
        if (regex.test(cleanTitle)) {
          eligibilityTags.push(tag.toLowerCase());
          cleanTitle = cleanTitle.replace(regex, ' ').trim();
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
