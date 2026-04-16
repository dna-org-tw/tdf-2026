import type { TicketTier } from './members';

export interface TicketPricing {
  key: TicketTier;
  originalPrice: number;
  salePrice: number;
  accent: string;
}

export const TICKET_PRICING: TicketPricing[] = [
  { key: 'explore', originalPrice: 30, salePrice: 25, accent: '#10B8D9' },
  { key: 'contribute', originalPrice: 300, salePrice: 250, accent: '#00993E' },
  { key: 'weekly_backer', originalPrice: 250, salePrice: 200, accent: '#FFD028' },
  { key: 'backer', originalPrice: 600, salePrice: 500, accent: '#FFD028' },
];

export const SALE_END = new Date('2026-03-31T23:59:59Z');

export function isOnSale(): boolean {
  return Date.now() < SALE_END.getTime();
}

export function getPricingByKey(key: TicketTier): TicketPricing | undefined {
  return TICKET_PRICING.find((p) => p.key === key);
}

// Festival date range
export const FESTIVAL_START = '2026-05-01';
export const FESTIVAL_END = '2026-05-31';

// Week-to-date mapping for weekly_backer tickets
export const WEEK_DATES: Record<string, { from: string; until: string }> = {
  week1: { from: '2026-05-01', until: '2026-05-07' },
  week2: { from: '2026-05-08', until: '2026-05-14' },
  week3: { from: '2026-05-15', until: '2026-05-21' },
  week4: { from: '2026-05-22', until: '2026-05-28' },
};

/**
 * Compute the validity period for a given ticket tier and optional week selection.
 */
export function getValidityPeriod(
  tier: TicketTier,
  week?: string | null,
): { valid_from: string; valid_until: string } {
  if (tier === 'weekly_backer' && week && WEEK_DATES[week]) {
    return { valid_from: WEEK_DATES[week].from, valid_until: WEEK_DATES[week].until };
  }
  return { valid_from: FESTIVAL_START, valid_until: FESTIVAL_END };
}
