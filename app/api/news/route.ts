import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rateLimitResponse';

const AOTTER_API_URL =
  'https://nb.aotter.net/api/public/post/publisher?q=69a6aeacb5863795d3709052';

export const revalidate = 3600; // ISR: revalidate every hour

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, { key: 'news', limit: 120, windowSeconds: 60 });
  if (rl) return rl;

  try {
    const res = await fetch(AOTTER_API_URL, { next: { revalidate: 3600 } });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch news' },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
