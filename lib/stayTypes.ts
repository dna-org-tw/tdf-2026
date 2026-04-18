export type StayBookingType = 'guaranteed' | 'complimentary';
export type StayBookingStatus = 'draft' | 'confirmed' | 'partially_transferred' | 'transferred' | 'cancelled' | 'completed';
export type StayBookingWeekStatus =
  | 'confirmed'
  | 'modified_out'
  | 'modified_in'
  | 'pending_transfer'
  | 'transferred'
  | 'cancelled'
  | 'no_show'
  | 'completed';

export interface StayWeekRow {
  id: number;
  code: string;
  starts_on: string;
  ends_on: string;
  price_twd: number;
  room_capacity: number;
  status: 'active' | 'sold_out' | 'closed';
  waitlist_offer_expires_in_minutes: number;
}
