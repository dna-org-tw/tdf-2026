import { TICKET_TIER_RANK, type TicketTier } from './members';

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
 * Get the current ticket price in USD (not cents) for a given tier.
 */
export function getTicketPrice(tier: TicketTier): number {
  const pricing = getPricingByKey(tier);
  if (!pricing) return 0;
  return isOnSale() ? pricing.salePrice : pricing.originalPrice;
}

/**
 * Compute the upgrade price difference in USD cents.
 * Returns null if upgrade is not allowed (target not higher rank).
 */
export function getUpgradePriceCents(
  fromTier: TicketTier,
  toTier: TicketTier,
): number | null {
  if (TICKET_TIER_RANK[toTier] <= TICKET_TIER_RANK[fromTier]) return null;
  const fromPrice = getTicketPrice(fromTier);
  const toPrice = getTicketPrice(toTier);
  const diff = toPrice - fromPrice;
  if (diff <= 0) return null;
  return Math.round(diff * 100);
}

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
