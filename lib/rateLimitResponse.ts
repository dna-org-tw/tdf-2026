import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { getClientIP } from '@/lib/clientIp';
import { content } from '@/data/content';

interface EnforceOptions {
  /** Stable key for this endpoint, e.g. 'visitors-record'. */
  key: string;
  /** Max requests allowed in the window. */
  limit: number;
  /** Window size in seconds. */
  windowSeconds: number;
}

function getLang(req: NextRequest): 'en' | 'zh' {
  const url = new URL(req.url);
  const langParam = url.searchParams.get('lang');
  if (langParam === 'en' || langParam === 'zh') return langParam;
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const refLang = new URL(referer).searchParams.get('lang');
      if (refLang === 'en' || refLang === 'zh') return refLang;
    } catch {
      /* noop */
    }
  }
  return 'zh';
}

/**
 * IP-based rate limit. Returns a 429 NextResponse if the caller is over the limit,
 * or null when the request may proceed. Uses `unknown` as the IP key when the
 * request has no proxy headers (e.g. localhost) — this is acceptable because the
 * only practical caller without headers is local development.
 */
export async function enforceRateLimit(
  req: NextRequest,
  opts: EnforceOptions
): Promise<NextResponse | null> {
  const ip = getClientIP(req) ?? 'unknown';
  const result = await checkRateLimit(`${opts.key}:${ip}`, {
    limit: opts.limit,
    windowSeconds: opts.windowSeconds,
  });

  if (result.allowed) return null;

  const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  const lang = getLang(req);
  return NextResponse.json(
    { error: content[lang].api.tooManyRequests },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSec) },
    }
  );
}
