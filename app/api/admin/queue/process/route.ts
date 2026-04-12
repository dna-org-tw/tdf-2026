import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { processQueueBatch } from '@/lib/notificationEmail';

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const notificationId = body?.notificationId;

  if (!notificationId) {
    return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
  }

  try {
    const result = await processQueueBatch(notificationId, 5);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Queue Process]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process queue' },
      { status: 500 }
    );
  }
}
