import { NextRequest, NextResponse } from 'next/server';
import { recordVisitor } from '@/lib/visitors';
import { getClientIP } from '@/lib/clientIp';
import { enforceRateLimit } from '@/lib/rateLimitResponse';

const MD5_REGEX = /^[a-f0-9]{32}$/;

async function getCountryFromIP(ip: string | null): Promise<string | null> {
  if (!ip || ip === 'localhost' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null;
  }
  try {
    const response = await fetch(`https://ipapi.co/${ip}/country/`, {
      headers: { 'User-Agent': 'Taiwan-Digital-Fest-2026' },
    });
    if (response.ok) {
      const country = await response.text();
      return country.trim() || null;
    }
  } catch (error) {
    console.error('[Visitors API] Failed to get country from IP:', error);
  }
  return null;
}

/**
 * POST /api/visitors/record
 * 記錄訪客資訊：fingerprint、IP、時區、語系等
 * Body: { fingerprint, timezone?, locale?, user_agent? }
 */
export async function POST(req: NextRequest) {
  const rl = enforceRateLimit(req, { key: 'visitors-record', limit: 180, windowSeconds: 60 });
  if (rl) return rl;

  try {
    const body = await req.json().catch(() => null);

    if (!body?.fingerprint || typeof body.fingerprint !== 'string') {
      return NextResponse.json(
        { error: 'fingerprint is required' },
        { status: 400 }
      );
    }

    const fingerprint = body.fingerprint.trim();
    if (!fingerprint || !MD5_REGEX.test(fingerprint)) {
      return NextResponse.json(
        { error: 'Invalid fingerprint format' },
        { status: 400 }
      );
    }

    const clientIP = getClientIP(req);
    const country = clientIP ? await getCountryFromIP(clientIP) : null;
    const userAgent = req.headers.get('user-agent') || null;

    const result = await recordVisitor({
      fingerprint,
      timezone: body.timezone ?? null,
      locale: body.locale ?? null,
      user_agent: body.user_agent ?? userAgent,
      ip_address: clientIP,
      country,
    });

    if (!result.visitor) {
      return NextResponse.json(
        {
          error: 'Failed to record visitor',
          detail: result.error ?? 'Unknown error',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, visitor_fingerprint: result.visitor.fingerprint },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Visitors API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
