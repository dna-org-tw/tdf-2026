const CALENDAR_API_ID = 'cal-S2KwfjOEzcZl8E8';

const BASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://lu.ma',
  Referer: 'https://lu.ma/',
};

export class LumaAuthError extends Error {
  constructor(public statusCode: number) {
    super(`luma_auth_${statusCode}`);
  }
}

export interface LumaCalendarItem {
  api_id: string;
  event: {
    api_id: string;
    name: string;
    start_at: string | null;
    end_at: string | null;
    url: string | null;
    cover_url: string | null;
    geo_address_json?: { full_address?: string } | null;
  };
}

export interface LumaGuest {
  api_id: string;
  email: string | null;
  approval_status?: string | null;
  registration_status?: string | null;
  paid?: boolean;
  checked_in_at?: string | null;
  registered_at?: string | null;
  ticket_type_name?: string | null;
  amount?: number | null;
  amount_cents?: number | null;
  currency?: string | null;
}

async function lumaFetch(url: string, cookie: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { ...BASE_HEADERS, Cookie: cookie },
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) {
    throw new LumaAuthError(res.status);
  }
  if (!res.ok) {
    throw new Error(`luma_http_${res.status}`);
  }
  return res.json();
}

export async function fetchCalendarItems(cookie: string): Promise<LumaCalendarItem[]> {
  const items: LumaCalendarItem[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      calendar_api_id: CALENDAR_API_ID,
      pagination_limit: '100',
      period: 'all',
    });
    if (cursor) params.set('pagination_cursor', cursor);
    const data = (await lumaFetch(
      `https://api2.luma.com/calendar/get-items?${params}`,
      cookie,
    )) as { entries?: LumaCalendarItem[]; next_cursor?: string | null; has_more?: boolean };
    for (const e of data.entries ?? []) items.push(e);
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return items;
}

export async function fetchEventGuests(eventApiId: string, cookie: string): Promise<LumaGuest[]> {
  const guests: LumaGuest[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 50; page++) {
    const params = new URLSearchParams({
      event_api_id: eventApiId,
      pagination_limit: '100',
    });
    if (cursor) params.set('pagination_cursor', cursor);
    const data = (await lumaFetch(
      `https://api2.luma.com/event/admin/get-guests?${params}`,
      cookie,
    )) as { entries?: Array<{ guest: LumaGuest }>; next_cursor?: string | null; has_more?: boolean };
    for (const e of data.entries ?? []) {
      if (e.guest) guests.push(e.guest);
    }
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return guests;
}
