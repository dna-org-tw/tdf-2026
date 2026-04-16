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
