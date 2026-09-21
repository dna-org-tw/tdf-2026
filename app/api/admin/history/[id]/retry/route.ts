import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { retryFailedEmails, processAllPending } from '@/lib/notificationEmail';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await retryFailedEmails(id);

    // Fire-and-forget: start processing retried emails
    if (result.retried > 0) {
      processAllPending(id).catch((err) =>
        console.error('[Retry] Background processing error:', err)
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Retry]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retry' },
      { status: 500 }
    );
  }
}
