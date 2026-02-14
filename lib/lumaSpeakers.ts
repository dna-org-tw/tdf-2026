import type { LumaApiEntry } from '@/lib/lumaSchedule';

export interface SpeakerEvent {
  eventName: string;
  eventUrl?: string;
}

/** Optional social/contact links from Luma host (handles or URLs). */
export interface SpeakerSocialLinks {
  website?: string | null;
  twitter_handle?: string | null;
  youtube_handle?: string | null;
  linkedin_handle?: string | null;
  instagram_handle?: string | null;
  tiktok_handle?: string | null;
}

export interface SpeakerGrouped {
  api_id: string;
  name: string;
  avatarUrl: string | null;
  username: string | null;
  /** Short bio from Luma host. */
  bioShort?: string | null;
  events: SpeakerEvent[];
  /** Social links from Luma host; only set when at least one is present. */
  social?: SpeakerSocialLinks | null;
}

interface HostEventRow {
  api_id: string;
  name: string;
  avatarUrl: string | null;
  username: string | null;
  bioShort?: string | null;
  eventName: string;
  eventUrl: string;
  social?: SpeakerSocialLinks | null;
}

const EXCLUDED_USERNAMES = ['tdna', 'taiwan_nomad'];

function groupSpeakers(rows: HostEventRow[]): SpeakerGrouped[] {
  const byId = new Map<
    string,
    {
      api_id: string;
      name: string;
      avatarUrl: string | null;
      username: string | null;
      bioShort?: string | null;
      events: SpeakerEvent[];
      social?: SpeakerSocialLinks | null;
    }
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
      if (row.social && !existing.social) existing.social = row.social;
      if (row.bioShort && !existing.bioShort) existing.bioShort = row.bioShort;
    } else {
      byId.set(row.api_id, {
        api_id: row.api_id,
        name: row.name,
        avatarUrl: row.avatarUrl,
        username: row.username,
        bioShort: row.bioShort ?? undefined,
        events: [event],
        social: row.social ?? undefined,
      });
    }
  }

  return Array.from(byId.values()).map((v) => ({
    api_id: v.api_id,
    name: v.name,
    avatarUrl: v.avatarUrl,
    username: v.username,
    bioShort: v.bioShort ?? null,
    events: v.events,
    social: v.social ?? null,
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

      const website = h.website && String(h.website).trim() ? String(h.website) : null;
      const twitter_handle = h.twitter_handle && String(h.twitter_handle).trim() ? String(h.twitter_handle) : null;
      const youtube_handle = h.youtube_handle && String(h.youtube_handle).trim() ? String(h.youtube_handle) : null;
      const linkedin_handle = h.linkedin_handle && String(h.linkedin_handle).trim() ? String(h.linkedin_handle) : null;
      const instagram_handle = h.instagram_handle && String(h.instagram_handle).trim() ? String(h.instagram_handle) : null;
      const tiktok_handle = h.tiktok_handle && String(h.tiktok_handle).trim() ? String(h.tiktok_handle) : null;

      const hasSocial = website || twitter_handle || youtube_handle || linkedin_handle || instagram_handle || tiktok_handle;
      const social: SpeakerSocialLinks | undefined = hasSocial
        ? { website, twitter_handle, youtube_handle, linkedin_handle, instagram_handle, tiktok_handle }
        : undefined;

      const bioShort = h.bio_short && String(h.bio_short).trim() ? String(h.bio_short).trim() : null;

      rows.push({
        api_id: h.api_id,
        name,
        avatarUrl:
          h.avatar_url && String(h.avatar_url).trim() ? String(h.avatar_url) : null,
        username: h.username && String(h.username).trim() ? String(h.username) : null,
        bioShort,
        eventName,
        eventUrl,
        social,
      });
    }
  }

  return groupSpeakers(rows);
}
