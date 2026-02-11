import { NextRequest, NextResponse } from 'next/server';

const EVENTS_WEBHOOK_URL = process.env.EVENTS_WEBHOOK_URL;

export type TrackEventBody = {
  eventType: 'standard' | 'custom';
  eventName: string;
  parameters?: Record<string, unknown>;
};

/**
 * 接收前端追蹤事件，轉發至 EVENTS_WEBHOOK_URL（若已設定）。
 * 與 Facebook Pixel 並行，不影響原有追蹤。
 */
export async function POST(request: NextRequest) {
  if (!EVENTS_WEBHOOK_URL || EVENTS_WEBHOOK_URL.trim() === '') {
    return NextResponse.json({ ok: true, forwarded: false });
  }

  let body: TrackEventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { eventType, eventName, parameters } = body;
  if (!eventName || typeof eventName !== 'string') {
    return NextResponse.json({ error: 'eventName is required' }, { status: 400 });
  }

  const payload = {
    eventType: eventType ?? 'custom',
    eventName,
    parameters: parameters ?? {},
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(EVENTS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn('[events/track] Webhook responded with', res.status, await res.text());
    }
  } catch (err) {
    console.warn('[events/track] Webhook request failed:', err);
    // 不讓前端失敗，僅記錄
  }

  return NextResponse.json({ ok: true, forwarded: true });
}
