import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  const secret =
    request.headers.get('x-ghost-webhook-secret') ||
    request.nextUrl.searchParams.get('secret');

  if (secret !== process.env.GHOST_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  revalidateTag('ghost-posts', 'max');

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
