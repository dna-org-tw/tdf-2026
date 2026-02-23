import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';

const EVENTS_WEBHOOK_URL = process.env.EVENTS_WEBHOOK_URL;
const META_CAPI_ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const META_CAPI_PIXEL_ID = process.env.META_CAPI_PIXEL_ID;
const META_CAPI_TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE;
const META_CAPI_API_VERSION = process.env.META_CAPI_API_VERSION || 'v23.0';

export type TrackEventBody = {
  eventType: 'standard' | 'custom';
  eventName: string;
  parameters?: Record<string, unknown>;
  eventId?: string;
};

function toSha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function pickString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildMetaUserData(request: NextRequest, parameters: Record<string, unknown>) {
  const ip = pickString(request.headers.get('x-forwarded-for')?.split(',')[0] ?? '');
  const userAgent = pickString(request.headers.get('user-agent'));
  const fbp = pickString(request.cookies.get('_fbp')?.value);
  const fbc = pickString(request.cookies.get('_fbc')?.value);
  const email = pickString(parameters.email ?? parameters.customer_email).toLowerCase();

  const userData: Record<string, string> = {};
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (email) userData.em = toSha256(email);

  return userData;
}

async function forwardToMetaCapi(
  request: NextRequest,
  eventName: string,
  parameters: Record<string, unknown>,
  eventId: string
) {
  if (!META_CAPI_ACCESS_TOKEN || !META_CAPI_PIXEL_ID) {
    return { forwarded: false };
  }

  const userData = buildMetaUserData(request, parameters);
  const metaPayload: Record<string, unknown> = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: eventId,
        event_source_url: request.headers.get('referer') || undefined,
        user_data: userData,
        custom_data: parameters,
      },
    ],
  };

  if (META_CAPI_TEST_EVENT_CODE) {
    metaPayload.test_event_code = META_CAPI_TEST_EVENT_CODE;
  }

  const endpoint = `https://graph.facebook.com/${META_CAPI_API_VERSION}/${META_CAPI_PIXEL_ID}/events`;
  const res = await fetch(`${endpoint}?access_token=${encodeURIComponent(META_CAPI_ACCESS_TOKEN)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metaPayload),
  });

  if (!res.ok) {
    const reason = await res.text();
    console.warn('[events/track] Meta CAPI responded with', res.status, reason);
    return { forwarded: false };
  }

  return { forwarded: true };
}

/**
 * 接收前端追蹤事件，轉發至 EVENTS_WEBHOOK_URL / Meta CAPI（若已設定）。
 * 與 Facebook Pixel 並行，不影響原有追蹤。
 */
export async function POST(request: NextRequest) {
  let body: TrackEventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { eventType, eventName, parameters, eventId } = body;
  if (!eventName || typeof eventName !== 'string') {
    return NextResponse.json({ error: 'eventName is required' }, { status: 400 });
  }

  const safeParameters = parameters ?? {};
  const safeEventId = eventId && typeof eventId === 'string'
    ? eventId
    : `srv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const payload = {
    eventType: eventType ?? 'custom',
    eventName,
    parameters: safeParameters,
    eventId: safeEventId,
    timestamp: new Date().toISOString(),
  };

  let webhookForwarded = false;
  if (EVENTS_WEBHOOK_URL && EVENTS_WEBHOOK_URL.trim() !== '') {
    try {
      const res = await fetch(EVENTS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.warn('[events/track] Webhook responded with', res.status, await res.text());
      }
      webhookForwarded = true;
    } catch (err) {
      console.warn('[events/track] Webhook request failed:', err);
      // 不讓前端失敗，僅記錄
    }
  }

  let capiForwarded = false;
  try {
    const res = await forwardToMetaCapi(request, eventName, safeParameters, safeEventId);
    capiForwarded = res.forwarded;
  } catch (err) {
    console.warn('[events/track] Meta CAPI request failed:', err);
  }

  return NextResponse.json({
    ok: true,
    forwarded: webhookForwarded || capiForwarded,
    webhookForwarded,
    capiForwarded,
  });
}
