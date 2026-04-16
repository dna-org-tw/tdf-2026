import { supabaseServer } from '@/lib/supabaseServer';
import { decryptCookie, encryptCookie } from '@/lib/lumaSyncCrypto';
import type { Registration, SyncConfigPublic } from '@/lib/lumaSyncTypes';

interface RawConfig {
  luma_session_cookie_enc: string | null;
  luma_session_cookie_iv: string | null;
  luma_session_cookie_tag: string | null;
  cookie_last4: string | null;
  cookie_invalid: boolean;
  cron_enabled: boolean;
  cron_schedule: string;
  last_manual_run_at: string | null;
  updated_by: string | null;
  updated_at: string;
}

function fromBase64(v: string | null): Buffer | null {
  return v ? Buffer.from(v, 'base64') : null;
}

async function loadRaw(): Promise<RawConfig | null> {
  if (!supabaseServer) return null;
  const { data, error } = await supabaseServer
    .from('luma_sync_config')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data as RawConfig;
}

export async function getPublicConfig(): Promise<SyncConfigPublic> {
  const r = await loadRaw();
  if (!r) {
    return {
      cookieLast4: null,
      cookieInvalid: false,
      cronEnabled: false,
      cronSchedule: '0 19 * * *',
      lastManualRunAt: null,
      updatedAt: new Date(0).toISOString(),
      updatedBy: null,
      hasCookie: false,
    };
  }
  return {
    cookieLast4: r.cookie_last4,
    cookieInvalid: r.cookie_invalid,
    cronEnabled: r.cron_enabled,
    cronSchedule: r.cron_schedule,
    lastManualRunAt: r.last_manual_run_at,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by,
    hasCookie: r.luma_session_cookie_enc !== null,
  };
}

export async function getDecryptedCookie(): Promise<string | null> {
  const r = await loadRaw();
  if (!r || !r.luma_session_cookie_enc || !r.luma_session_cookie_iv || !r.luma_session_cookie_tag) {
    return null;
  }
  return decryptCookie(
    fromBase64(r.luma_session_cookie_enc)!,
    fromBase64(r.luma_session_cookie_iv)!,
    fromBase64(r.luma_session_cookie_tag)!,
  );
}

export async function updateConfig(input: {
  cookie?: string;
  cronEnabled?: boolean;
  cronSchedule?: string;
  updatedBy: string;
}): Promise<void> {
  if (!supabaseServer) throw new Error('db');
  const patch: Record<string, unknown> = {
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
  };
  if (input.cookie !== undefined) {
    const trimmed = input.cookie.trim();
    if (trimmed.length === 0) {
      patch.luma_session_cookie_enc = null;
      patch.luma_session_cookie_iv = null;
      patch.luma_session_cookie_tag = null;
      patch.cookie_last4 = null;
    } else {
      const { enc, iv, tag, last4 } = encryptCookie(trimmed);
      patch.luma_session_cookie_enc = enc.toString('base64');
      patch.luma_session_cookie_iv = iv.toString('base64');
      patch.luma_session_cookie_tag = tag.toString('base64');
      patch.cookie_last4 = last4;
    }
    patch.cookie_invalid = false;
  }
  if (input.cronEnabled !== undefined) patch.cron_enabled = input.cronEnabled;
  if (input.cronSchedule !== undefined) patch.cron_schedule = input.cronSchedule;
  const { error } = await supabaseServer.from('luma_sync_config').update(patch).eq('id', 1);
  if (error) throw error;
}

export async function markCookieInvalid(): Promise<void> {
  if (!supabaseServer) return;
  await supabaseServer.from('luma_sync_config').update({ cookie_invalid: true }).eq('id', 1);
}

export async function touchManualRun(): Promise<void> {
  if (!supabaseServer) return;
  await supabaseServer
    .from('luma_sync_config')
    .update({ last_manual_run_at: new Date().toISOString() })
    .eq('id', 1);
}

export interface LumaGuestRow {
  event_api_id: string;
  activity_status: string | null;
  paid: boolean;
  checked_in_at: string | null;
  registered_at: string | null;
  ticket_type_name: string | null;
  amount_cents: number | null;
  currency: string | null;
  last_synced_at: string;
  luma_events: {
    name: string;
    start_at: string | null;
    end_at: string | null;
    url: string | null;
  } | null;
}

export async function shapeRegistrations(rows: LumaGuestRow[]): Promise<Registration[]> {
  let staleCutoff: number | null = null;
  if (supabaseServer) {
    const { data: lastJob } = await supabaseServer
      .from('luma_sync_jobs')
      .select('started_at')
      .in('status', ['succeeded', 'partial'])
      .order('started_at', { ascending: false })
      .limit(1);
    const ts = lastJob?.[0]?.started_at;
    if (ts) staleCutoff = new Date(ts).getTime() - 24 * 60 * 60 * 1000;
  }

  return rows.map((r) => ({
    eventApiId: r.event_api_id,
    eventName: r.luma_events?.name ?? r.event_api_id,
    startAt: r.luma_events?.start_at ?? null,
    endAt: r.luma_events?.end_at ?? null,
    url: r.luma_events?.url ?? null,
    activityStatus: r.activity_status,
    paid: r.paid,
    checkedInAt: r.checked_in_at,
    registeredAt: r.registered_at,
    ticketTypeName: r.ticket_type_name,
    amountCents: r.amount_cents,
    currency: r.currency,
    stale: staleCutoff !== null && new Date(r.last_synced_at).getTime() < staleCutoff,
  }));
}
