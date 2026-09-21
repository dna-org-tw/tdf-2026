// lib/basePath.ts
// basePath-aware helpers. Next.js does NOT auto-prefix root-relative string
// literals with basePath. <Link>/router/redirect get it, but:
//   - fetch() string literals do NOT  -> wrap in apiFetch()
//   - next/image local src does NOT get basePath on the optimizer `url` param
//     (only the /_next/image endpoint is prefixed), so local public/ images
//     404 through the optimizer -> wrap their src in asset().
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * Prefix a root-relative local asset path (e.g. a public/ image) with
 * BASE_PATH so next/image's optimizer can resolve it under the basePath.
 * Absolute URLs (http(s)://) and protocol-relative URLs pass through unchanged.
 */
export function asset(path: string): string {
  return /^https?:\/\//i.test(path) || path.startsWith('//') ? path : `${BASE_PATH}${path}`;
}

/**
 * fetch() wrapper that prepends BASE_PATH to root-relative request paths.
 * Absolute URLs (http(s)://) and protocol-relative URLs pass through unchanged.
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = /^https?:\/\//i.test(input) || input.startsWith('//')
    ? input
    : `${BASE_PATH}${input}`;
  return fetch(url, init);
}
