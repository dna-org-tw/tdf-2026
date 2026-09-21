// Luma's API returns `event.url` as a slug (e.g. "tdf-foo"), not a full URL.
// Older rows in `luma_events.url` were persisted as raw slugs, so anything
// rendering them as `<a href>` ends up treating them as relative paths.
// Normalise here so callers can trust the field as a real URL.
export function toLumaEventUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://lu.ma/${v.replace(/^\/+/, '')}`;
}
