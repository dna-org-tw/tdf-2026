import { NextRequest, NextResponse } from 'next/server';
import { runStayReconcile } from '@/lib/stayReconcile';

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: 'cron_disabled' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runStayReconcile();
  return NextResponse.json({ ok: true, result });
}
