import type { NextRequest } from 'next/server';

/**
 * Extract the client IP from standard proxy headers.
 * Order: x-forwarded-for → x-real-ip → cf-connecting-ip.
 * Returns null when no header is present.
 */
export function getClientIP(req: NextRequest): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;

  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  return null;
}
