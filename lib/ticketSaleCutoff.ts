// lib/ticketSaleCutoff.ts
import { supabaseServer } from './supabaseServer';

// 2026-04-21 00:00:00 Asia/Taipei (UTC+8) = 2026-04-20T16:00:00Z
export const DEFAULT_CUTOFF_ISO = '2026-04-20T16:00:00Z';
export const CUTOFF_KEY = 'ticket_sale_cutoff';

export class TicketSaleError extends Error {
  constructor(message: string, public httpStatus: number = 400) {
    super(message);
  }
}

export async function getTicketSaleCutoffRaw(): Promise<string | null> {
  if (!supabaseServer) return null;
  const { data } = await supabaseServer
    .from('app_settings')
    .select('value')
    .eq('key', CUTOFF_KEY)
    .maybeSingle();
  return (data?.value as string | undefined) ?? null;
}

export async function getTicketSaleCutoff(): Promise<Date> {
  const raw = await getTicketSaleCutoffRaw().catch(() => null);
  const iso = raw ?? DEFAULT_CUTOFF_ISO;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return new Date(DEFAULT_CUTOFF_ISO);
  return d;
}

export async function isTicketSaleClosed(): Promise<boolean> {
  const cutoff = await getTicketSaleCutoff();
  return Date.now() >= cutoff.getTime();
}

export async function setTicketSaleCutoff(iso: string, adminEmail: string): Promise<string> {
  if (!supabaseServer) throw new TicketSaleError('DB not configured', 500);
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) throw new TicketSaleError('Invalid ISO 8601 timestamp');
  const value = parsed.toISOString();
  const { error } = await supabaseServer
    .from('app_settings')
    .upsert(
      {
        key: CUTOFF_KEY,
        value,
        updated_by: adminEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
  if (error) throw new TicketSaleError(error.message, 500);
  return value;
}
