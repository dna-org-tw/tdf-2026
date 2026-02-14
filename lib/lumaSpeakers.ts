export interface SpeakerEvent {
  eventName: string;
  eventUrl?: string;
}

export interface SpeakerGrouped {
  name: string;
  avatarUrl: string | null;
  username: string | null;
  events: SpeakerEvent[];
}

interface LumaHost {
  name: string | null;
  api_id: string;
  avatar_url?: string | null;
  username?: string | null;
  [key: string]: unknown;
}

interface HostEventRow {
  api_id: string;
  name: string;
  avatarUrl: string | null;
  username: string | null;
  eventName: string;
  eventUrl: string;
}

export interface SpeakerEventInput {
  slug: string;
  name: string;
  url: string;
}

function extractHostsFromHtml(html: string): LumaHost[] {
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!nextDataMatch) return [];

  let nextData: Record<string, unknown>;
  try {
    nextData = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
  } catch {
    return [];
  }

  const findHosts = (obj: unknown): LumaHost[] | null => {
    if (Array.isArray(obj) && obj.length > 0 && (obj[0] as LumaHost)?.api_id) {
      return obj as LumaHost[];
    }
    if (typeof obj === 'object' && obj !== null) {
      const record = obj as Record<string, unknown>;
      if (record.hosts && Array.isArray(record.hosts)) {
        return record.hosts as LumaHost[];
      }
      for (const key in record) {
        const result = findHosts(record[key]);
        if (result) return result;
      }
    }
    return null;
  };

  const hosts = findHosts(nextData.props);
  return hosts || [];
}

async function fetchHostsForEvent(
  eventSlug: string,
  eventName: string,
  eventUrl: string
): Promise<HostEventRow[]> {
  const pageUrl = eventSlug.startsWith('http')
    ? eventSlug
    : `https://luma.com/${eventSlug}`;

  try {
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const html = await res.text();
    const hosts = extractHostsFromHtml(html);

    return hosts
      .filter((h) => h.name && String(h.name).trim().length > 0)
      .map((h) => ({
        api_id: h.api_id,
        name: String(h.name).trim(),
        avatarUrl: h.avatar_url && String(h.avatar_url).trim() ? String(h.avatar_url) : null,
        username: h.username && String(h.username).trim() ? String(h.username) : null,
        eventName,
        eventUrl: eventUrl || '',
      }));
  } catch {
    return [];
  }
}

const CONCURRENCY = 4;

async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R[]>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      const part = await fn(items[i]);
      results.push(...part);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

const EXCLUDED_USERNAMES = ['tdna', 'taiwan_nomad'];

function groupSpeakers(rows: HostEventRow[]): SpeakerGrouped[] {
  const byId = new Map<string, { name: string; avatarUrl: string | null; username: string | null; events: SpeakerEvent[] }>();

  for (const row of rows) {
    const usernameLower = row.username?.toLowerCase();
    if (usernameLower && EXCLUDED_USERNAMES.includes(usernameLower)) continue;

    const existing = byId.get(row.api_id);
    const event: SpeakerEvent = { eventName: row.eventName, eventUrl: row.eventUrl || undefined };
    if (existing) {
      const alreadyHas = existing.events.some((e) => e.eventName === row.eventName && e.eventUrl === row.eventUrl);
      if (!alreadyHas) existing.events.push(event);
    } else {
      byId.set(row.api_id, {
        name: row.name,
        avatarUrl: row.avatarUrl,
        username: row.username,
        events: [event],
      });
    }
  }

  return Array.from(byId.values()).map((v) => ({
    name: v.name,
    avatarUrl: v.avatarUrl,
    username: v.username,
    events: v.events,
  }));
}

/**
 * Build speaker list from event list (e.g. from same calendar entries as schedule).
 * Uses the same concurrency and dedup limits as the standalone speakers API.
 */
export async function getSpeakersFromEventList(
  eventList: SpeakerEventInput[],
  options?: { maxEvents?: number }
): Promise<SpeakerGrouped[]> {
  const maxEvents = options?.maxEvents ?? 50;
  const uniqueEvents = eventList.slice(0, maxEvents);
  const rows = await runWithConcurrency(
    uniqueEvents,
    (ev) => fetchHostsForEvent(ev.slug, ev.name, ev.url),
    CONCURRENCY
  );
  return groupSpeakers(rows);
}
