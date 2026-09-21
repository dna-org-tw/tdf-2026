import { createHash } from 'node:crypto';
import { checkRateLimit } from '@/lib/rateLimit';
import { supabaseServer } from '@/lib/supabaseServer';
import { TICKET_TIER_RANK, type TicketTier } from '@/lib/members';
import { getValidityPeriod, FESTIVAL_START } from '@/lib/ticketPricing';
import type { Order } from '@/lib/types/order';

const HAN_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/u;

export interface MemberVisaProfileInput {
  legal_name_en: string;
  nationality: string;
  date_of_birth: string;
  passport_number: string;
  passport_country: string;
  passport_expiry_date: string;
  planned_arrival_date: string;
  planned_departure_date: string;
  taiwan_stay_address: string;
  destination_mission: string | null;
  notes_for_letter: string | null;
}

export interface MemberRow {
  id: number;
  member_no: string;
  email: string;
}

export interface PaidOrderSnapshot {
  id: string;
  ticket_tier: TicketTier;
  status: 'paid';
  amount_total: number;
  currency: string;
  valid_from: string;
  valid_until: string;
  created_at: string;
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function validateVisaProfileInput(body: unknown): { data?: MemberVisaProfileInput; error?: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid body' };

  const legalName = trimOrNull((body as Record<string, unknown>).legal_name_en);
  const nationality = trimOrNull((body as Record<string, unknown>).nationality);
  const dob = trimOrNull((body as Record<string, unknown>).date_of_birth);
  const passportNumber = trimOrNull((body as Record<string, unknown>).passport_number)?.toUpperCase() ?? null;
  const passportCountry = trimOrNull((body as Record<string, unknown>).passport_country);
  const passportExpiry = trimOrNull((body as Record<string, unknown>).passport_expiry_date);
  const arrival = trimOrNull((body as Record<string, unknown>).planned_arrival_date);
  const departure = trimOrNull((body as Record<string, unknown>).planned_departure_date);
  const stayAddress = trimOrNull((body as Record<string, unknown>).taiwan_stay_address);
  const destinationMission = trimOrNull((body as Record<string, unknown>).destination_mission);
  const notes = trimOrNull((body as Record<string, unknown>).notes_for_letter);

  if (!legalName || !nationality || !dob || !passportNumber || !passportCountry || !passportExpiry || !arrival || !departure || !stayAddress) {
    return { error: 'Missing required fields' };
  }
  if (HAN_RE.test(legalName)) {
    return { error: 'Legal name must be entered in passport English only' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dobDate = new Date(dob);
  const arrivalDate = new Date(arrival);
  const departureDate = new Date(departure);
  const passportExpiryDate = new Date(passportExpiry);

  if (Number.isNaN(dobDate.getTime()) || Number.isNaN(arrivalDate.getTime()) || Number.isNaN(departureDate.getTime()) || Number.isNaN(passportExpiryDate.getTime())) {
    return { error: 'Invalid date values' };
  }
  if (dobDate >= today) return { error: 'Date of birth must be in the past' };
  if (departureDate <= arrivalDate) return { error: 'Planned departure must be after planned arrival' };
  if (passportExpiryDate <= departureDate) return { error: 'Passport expiry must be after planned departure' };

  return {
    data: {
      legal_name_en: legalName,
      nationality,
      date_of_birth: dob,
      passport_number: passportNumber,
      passport_country: passportCountry,
      passport_expiry_date: passportExpiry,
      planned_arrival_date: arrival,
      planned_departure_date: departure,
      taiwan_stay_address: stayAddress,
      destination_mission: destinationMission,
      notes_for_letter: notes,
    },
  };
}

export async function getMemberByEmail(email: string): Promise<MemberRow | null> {
  if (!supabaseServer) throw new Error('Database not configured');
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabaseServer
    .from('members')
    .select('id, member_no, email')
    .eq('email', normalized)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, member_no: data.member_no, email: data.email } : null;
}

export async function getVisaProfile(memberId: number) {
  if (!supabaseServer) throw new Error('Database not configured');
  const { data, error } = await supabaseServer
    .from('member_visa_profiles')
    .select('*')
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertVisaProfile(memberId: number, input: MemberVisaProfileInput) {
  if (!supabaseServer) throw new Error('Database not configured');
  const { data, error } = await supabaseServer
    .from('member_visa_profiles')
    .upsert({ member_id: memberId, ...input }, { onConflict: 'member_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

function resolveValidity(order: Pick<Order, 'ticket_tier' | 'valid_from' | 'valid_until'>): { valid_from: string; valid_until: string } {
  if (order.valid_from && order.valid_until) {
    return { valid_from: order.valid_from, valid_until: order.valid_until };
  }
  return getValidityPeriod(order.ticket_tier);
}

export function pickBestPaidOrder(orders: Order[]): PaidOrderSnapshot | null {
  const paid = orders.filter((order) => order.status === 'paid');
  if (paid.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const festivalStarted = today >= FESTIVAL_START;

  const rank = (order: Order) => TICKET_TIER_RANK[order.ticket_tier];
  const byRankThenCreated = (a: Order, b: Order) => {
    const rankDiff = rank(b) - rank(a);
    if (rankDiff !== 0) return rankDiff;
    return b.created_at.localeCompare(a.created_at);
  };

  const active = festivalStarted
    ? paid.filter((order) => {
        const validity = resolveValidity(order);
        return today >= validity.valid_from && today <= validity.valid_until;
      })
    : [];

  const best = (active.length > 0 ? active : paid).sort(byRankThenCreated)[0];
  const validity = resolveValidity(best);
  return {
    id: best.id,
    ticket_tier: best.ticket_tier,
    status: 'paid',
    amount_total: best.amount_total,
    currency: best.currency,
    valid_from: validity.valid_from,
    valid_until: validity.valid_until,
    created_at: best.created_at,
  };
}

export async function getPaidOrdersForEmail(email: string): Promise<Order[]> {
  if (!supabaseServer) throw new Error('Database not configured');
  const { data, error } = await supabaseServer
    .from('orders')
    .select('*')
    .eq('customer_email', email.trim().toLowerCase())
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Order[];
}

export async function enforceVisaLetterRateLimit(memberNo: string) {
  const result = await checkRateLimit(`visa-letter:${memberNo}`, {
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    const error = new Error('RATE_LIMITED');
    (error as Error & { retryAfter?: number }).retryAfter = retryAfter;
    throw error;
  }
  return result;
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function formatIssueDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}
