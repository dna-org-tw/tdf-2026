// lib/basePath.ts
// basePath-aware helpers. Next.js does NOT auto-prefix fetch() string
// literals with basePath (only <Link>/next-image/router/redirect get it),
// so all client-side root-relative fetches must go through apiFetch().
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

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
