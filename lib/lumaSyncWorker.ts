import { supabaseServer } from '@/lib/supabaseServer';
import {
  fetchCalendarItems,
  fetchEventGuests,
  LumaAuthError,
  type LumaCalendarItem,
  type LumaGuest,
} from '@/lib/lumaApi';
import { getDecryptedCookie, markCookieInvalid } from '@/lib/lumaSyncConfig';
import { sendCookieExpiredAlert } from '@/lib/luma-alert-email';

const SLEEP_MS_BETWEEN_EVENTS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function db() {
  if (!supabaseServer) throw new Error('db_not_configured');
  return supabaseServer;
}

function mapCalendarItem(item: LumaCalendarItem) {
  const ev = item.event;
  return {
    event_api_id: ev.api_id,
    name: ev.name,
    start_at: ev.start_at,
    end_at: ev.end_at,
    url: ev.url,
    cover_url: ev.cover_url,
    location_text: ev.geo_address_json?.full_address ?? null,
    last_synced_at: new Date().toISOString(),
  };
}

interface MappedGuest {
  event_api_id: string;
  email: string;
  luma_guest_api_id: string | null;
  activity_status: string | null;
  paid: boolean;
  checked_in_at: string | null;
  registered_at: string | null;
  ticket_type_name: string | null;
  amount_cents: number | null;
  currency: string | null;
  last_synced_at: string;
}

function mapGuest(g: LumaGuest, eventApiId: string): MappedGuest | null {
  const email = (g.email ?? '').trim().toLowerCase();
  if (!email) return null;
  const ticket = g.event_tickets?.[0];
  const amountCents = typeof ticket?.amount === 'number' ? Math.round(ticket.amount) : null;
  const isFree = ticket?.event_ticket_type_info?.type === 'free' || amountCents === 0;
  return {
    event_api_id: eventApiId,
    email,
    luma_guest_api_id: g.api_id ?? null,
    activity_status: g.approval_status ?? g.registration_status ?? null,
    paid: ticket?.is_captured === true || (isFree && g.approval_status === 'approved'),
    checked_in_at: g.checked_in_at ?? null,
    registered_at: g.registered_at ?? null,
    ticket_type_name: ticket?.event_ticket_type_info?.name ?? null,
    amount_cents: amountCents,
    currency: ticket?.currency ?? null,
    last_synced_at: new Date().toISOString(),
  };
}

async function failJob(jobId: number, reason: string) {
  await db()
    .from('luma_sync_jobs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_summary: reason,
    })
    .eq('id', jobId);
}

export async function runSyncJob(jobId: number): Promise<void> {
  const supa = db();
  const startedAt = new Date().toISOString();
  await supa.from('luma_sync_jobs').update({ status: 'running', started_at: startedAt }).eq('id', jobId);

  let cookie: string | null = null;
  try {
    cookie = await getDecryptedCookie();
  } catch (err) {
    await failJob(jobId, `cookie_decrypt_failed: ${(err as Error).message}`);
    await sendCookieExpiredAlert('decryption failed');
    return;
  }
  if (!cookie) {
    await failJob(jobId, 'no_cookie_configured');
    return;
  }

  let items: LumaCalendarItem[];
  try {
    items = await fetchCalendarItems(cookie);
  } catch (err) {
    if (err instanceof LumaAuthError) {
      await markCookieInvalid();
      await sendCookieExpiredAlert(`get-items returned ${err.statusCode}`);
      await failJob(jobId, `cookie_invalid_${err.statusCode}`);
    } else {
      await failJob(jobId, `calendar_fetch_failed: ${(err as Error).message}`);
    }
    return;
  }

  if (items.length > 0) {
    const eventRows = items.map(mapCalendarItem);
    const { error } = await supa.from('luma_events').upsert(eventRows, { onConflict: 'event_api_id' });
    if (error) {
      await failJob(jobId, `events_upsert_failed: ${error.message}`);
      return;
    }
  }

  const totalEvents = items.length;
  await supa.from('luma_sync_jobs').update({ total_events: totalEvents }).eq('id', jobId);

  if (totalEvents > 0) {
    await supa.from('luma_sync_event_results').insert(
      items.map((it) => ({
        job_id: jobId,
        event_api_id: it.event.api_id,
        event_name: it.event.name,
        status: 'pending' as const,
      })),
    );
  }

  let processed = 0;
  let failed = 0;
  let totalGuestsUpserted = 0;
  let cookieAuthFailure = false;

  for (const item of items) {
    const eventApiId = item.event.api_id;

    await supa
      .from('luma_sync_event_results')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('job_id', jobId)
      .eq('event_api_id', eventApiId);

    try {
      const guests = await fetchEventGuests(eventApiId, cookie);
      const rows = guests
        .map((g) => mapGuest(g, eventApiId))
        .filter((r): r is MappedGuest => r !== null);

      if (rows.length > 0) {
        for (let i = 0; i < rows.length; i += 200) {
          const slice = rows.slice(i, i + 200);
          const { error } = await supa
            .from('luma_guests')
            .upsert(slice, { onConflict: 'event_api_id,email' });
          if (error) throw error;
        }
      }

      totalGuestsUpserted += rows.length;
      processed += 1;
      await supa
        .from('luma_sync_event_results')
        .update({
          status: 'done',
          guests_count: rows.length,
          finished_at: new Date().toISOString(),
        })
        .eq('job_id', jobId)
        .eq('event_api_id', eventApiId);
    } catch (err) {
      failed += 1;
      const message = (err as Error).message ?? 'unknown';
      await supa
        .from('luma_sync_event_results')
        .update({
          status: 'failed',
          error_message: message,
          finished_at: new Date().toISOString(),
        })
        .eq('job_id', jobId)
        .eq('event_api_id', eventApiId);
      if (err instanceof LumaAuthError) {
        cookieAuthFailure = true;
        break;
      }
    }

    await supa
      .from('luma_sync_jobs')
      .update({
        processed_events: processed,
        failed_events: failed,
        total_guests_upserted: totalGuestsUpserted,
      })
      .eq('id', jobId);

    await sleep(SLEEP_MS_BETWEEN_EVENTS);
  }

  if (cookieAuthFailure) {
    await markCookieInvalid();
    await sendCookieExpiredAlert('get-guests returned 401/403 mid-job');
    await supa
      .from('luma_sync_jobs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_summary: 'cookie_invalid_during_run',
      })
      .eq('id', jobId);
    return;
  }

  const finalStatus = failed === 0 ? 'succeeded' : processed > 0 ? 'partial' : 'failed';
  await supa
    .from('luma_sync_jobs')
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      processed_events: processed,
      failed_events: failed,
      total_guests_upserted: totalGuestsUpserted,
    })
    .eq('id', jobId);
}
