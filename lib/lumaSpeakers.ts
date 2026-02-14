import type { LumaApiEntry } from '@/lib/lumaSchedule';

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

interface HostEventRow {
  api_id: string;
  name: string;
  avatarUrl: string | null;
  username: string | null;
  eventName: string;
  eventUrl: string;
}

const EXCLUDED_USERNAMES = ['tdna', 'taiwan_nomad'];

function groupSpeakers(rows: HostEventRow[]): SpeakerGrouped[] {
  const byId = new Map<
    string,
    { name: string; avatarUrl: string | null; username: string | null; events: SpeakerEvent[] }
  >();

  for (const row of rows) {
    const usernameLower = row.username?.toLowerCase();
    if (usernameLower && EXCLUDED_USERNAMES.includes(usernameLower)) continue;

    const existing = byId.get(row.api_id);
    const event: SpeakerEvent = { eventName: row.eventName, eventUrl: row.eventUrl || undefined };
    if (existing) {
      const alreadyHas = existing.events.some(
        (e) => e.eventName === row.eventName && e.eventUrl === row.eventUrl
      );
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
 * Build speaker list from Luma calendar API entries (uses each entry's `hosts`).
 * No HTML scraping — single source of truth from API.
 */
export function getSpeakersFromEntries(entries: LumaApiEntry[]): SpeakerGrouped[] {
  const rows: HostEventRow[] = [];

  for (const entry of entries) {
    const hosts = entry.hosts ?? [];
    const eventName = entry.event?.name?.trim() ?? '';
    const eventUrl = entry.event?.url
      ? entry.event.url.startsWith('http')
        ? entry.event.url
        : `https://lu.ma/${entry.event.url}`
      : '';

    if (!eventName) continue;

    for (const h of hosts) {
      const name = h.name && String(h.name).trim();
      if (!name) continue;

      rows.push({
        api_id: h.api_id,
        name,
        avatarUrl:
          h.avatar_url && String(h.avatar_url).trim() ? String(h.avatar_url) : null,
        username: h.username && String(h.username).trim() ? String(h.username) : null,
        eventName,
        eventUrl,
      });
    }
  }

  return groupSpeakers(rows);
}
