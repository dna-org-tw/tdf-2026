import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { supabaseServer } from '@/lib/supabaseServer';
import { enforceRateLimit } from '@/lib/rateLimitResponse';

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

type PersistedEvent = {
  eventId: string;
  eventType: 'standard' | 'custom';
  eventName: string;
  parameters: Record<string, unknown>;
  occurredAt: string;
  clientIp: string | null;
  userAgent: string | null;
  referer: string | null;
};

async function persistEvent(evt: PersistedEvent) {
  if (!supabaseServer) return { persisted: false };

  const { error } = await supabaseServer
    .from('tracking_events')
    .upsert(
      {
        event_id: evt.eventId,
        event_type: evt.eventType,
        event_name: evt.eventName,
        parameters: evt.parameters,
        client_ip: evt.clientIp,
        user_agent: evt.userAgent,
        referer: evt.referer,
        occurred_at: evt.occurredAt,
      },
      { onConflict: 'event_id', ignoreDuplicates: true }
    );

  if (error) {
    console.warn('[events/track] Supabase insert failed:', error.message);
    return { persisted: false };
  }
  return { persisted: true };
}

async function dispatchEventActions(_evt: PersistedEvent) {
  // Action dispatch skeleton: if specific events (e.g. InitiateCheckout, CompleteRegistration)
  // need to trigger notifications or external integrations, dispatch here. Currently a no-op.
}

/**
 * Receive frontend tracking events, persist to Supabase tracking_events,
 * and forward to Meta CAPI (if configured). Runs alongside Facebook Pixel without affecting existing tracking.
 */
export async function POST(request: NextRequest) {
  const rl = await enforceRateLimit(request, { key: 'events-track', limit: 180, windowSeconds: 60 });
  if (rl) return rl;

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
  const safeEventType: 'standard' | 'custom' = eventType === 'standard' ? 'standard' : 'custom';

  const persisted: PersistedEvent = {
    eventId: safeEventId,
    eventType: safeEventType,
    eventName,
    parameters: safeParameters,
    occurredAt: new Date().toISOString(),
    clientIp: pickString(request.headers.get('x-forwarded-for')?.split(',')[0] ?? '') || null,
    userAgent: pickString(request.headers.get('user-agent')) || null,
    referer: request.headers.get('referer') || null,
  };

  let persistedOk = false;
  try {
    const res = await persistEvent(persisted);
    persistedOk = res.persisted;
  } catch (err) {
    console.warn('[events/track] persistEvent threw:', err);
  }

  try {
    await dispatchEventActions(persisted);
  } catch (err) {
    console.warn('[events/track] dispatchEventActions threw:', err);
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
    persisted: persistedOk,
    capiForwarded,
  });
}
