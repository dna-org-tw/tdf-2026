// lib/seo.ts
import type { Metadata } from 'next';

/**
 * Self-referencing canonical + hreflang alternates for a route.
 *
 * Pass a clean App Router path (e.g. '/' or '/code-of-conduct'); Next.js joins
 * it onto `metadataBase` (which carries the /2026 basePath), so the emitted
 * canonical resolves to the page's own URL — NOT the homepage.
 *
 * Why this exists: the root layout declares `alternates`, and any child segment
 * that does not override `alternates` INHERITS the root's `canonical: '/'`,
 * making every subpage claim the homepage as canonical (risking de-indexing).
 * Each indexable subpage must call this with its own path.
 *
 * The site serves zh-TW / en via the `?lang=` query param (no path-based i18n),
 * so the canonical is the clean path (consolidating the lang variants) and the
 * language alternates point at the per-route `?lang=` URLs.
 */
export function routeAlternates(path: string): NonNullable<Metadata['alternates']> {
  const sep = path.includes('?') ? '&' : '?';
  return {
    canonical: path,
    languages: {
      en: `${path}${sep}lang=en`,
      'zh-TW': `${path}${sep}lang=zh`,
      'x-default': path,
    },
  };
}
