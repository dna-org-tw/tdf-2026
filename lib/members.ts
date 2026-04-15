// lib/members.ts
// Shared types and constants for the members model.

export type MemberStatus = 'paid' | 'pending' | 'abandoned' | 'subscriber' | 'other';
export type MemberTier = 'S' | 'A' | 'B' | 'C';
export type TicketTier = 'explore' | 'contribute' | 'weekly_backer' | 'backer';

export const MEMBER_STATUSES: MemberStatus[] = ['paid', 'pending', 'abandoned', 'subscriber', 'other'];
export const MEMBER_TIERS: MemberTier[] = ['S', 'A', 'B', 'C'];
export const TICKET_TIERS: TicketTier[] = ['explore', 'contribute', 'weekly_backer', 'backer'];

// Used by the SQL view and kept here for reference / client labels.
export const TICKET_TIER_RANK: Record<TicketTier, number> = {
  explore: 1,
  contribute: 2,
  weekly_backer: 3,
  backer: 4,
};

export const TICKET_TIER_SCORE: Record<TicketTier, number> = {
  explore: 8,
  contribute: 15,
  weekly_backer: 25,
  backer: 40,
};

// Tier bucket thresholds (lower bound inclusive).
export const TIER_THRESHOLDS: Record<MemberTier, number> = {
  S: 50,
  A: 20,
  B: 5,
  C: 0,
};

export interface EnrichedMember {
  email: string;
  name: string | null;
  phone: string | null;
  status: MemberStatus;
  paid_order_count: number;
  total_spent_cents: number;
  currency: string;
  highest_ticket_tier: TicketTier | null;
  last_order_at: string | null;
  last_interaction_at: string | null;
  email_sent_count: number;
  email_open_count: number;
  email_click_count: number;
  email_open_rate: number | null;
  score: number;
  tier: MemberTier;
  subscribed_newsletter: boolean;
  in_orders: boolean;
}

export const STATUS_LABELS_ZH: Record<MemberStatus, string> = {
  paid: '已付費',
  pending: '待付款',
  abandoned: '已放棄',
  subscriber: '訂閱者',
  other: '其他',
};

export const STATUS_BADGE_CLASSES: Record<MemberStatus, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-800',
  abandoned: 'bg-orange-100 text-orange-700',
  subscriber: 'bg-blue-100 text-blue-700',
  other: 'bg-slate-100 text-slate-600',
};

export const TIER_BADGE_CLASSES: Record<MemberTier, string> = {
  S: 'bg-purple-100 text-purple-700',
  A: 'bg-red-100 text-red-700',
  B: 'bg-yellow-100 text-yellow-800',
  C: 'bg-slate-100 text-slate-600',
};

export const TIER_LABELS_ZH: Record<MemberTier, string> = {
  S: 'S (VIP)',
  A: 'A (熱)',
  B: 'B (溫)',
  C: 'C (冷)',
};

export const TICKET_TIER_LABELS: Record<TicketTier, string> = {
  explore: 'Explore',
  contribute: 'Contribute',
  weekly_backer: 'Weekly Backer',
  backer: 'Backer',
};

export const TICKET_TIER_BADGE_CLASSES: Record<TicketTier, string> = {
  explore: 'bg-blue-100 text-blue-700',
  contribute: 'bg-teal-100 text-teal-700',
  weekly_backer: 'bg-amber-100 text-amber-700',
  backer: 'bg-purple-100 text-purple-700',
};
