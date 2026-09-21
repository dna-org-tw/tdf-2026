import type { OrderStatus } from '@/lib/types/order';

/**
 * Map Stripe payment status + session status to internal order status.
 *
 * Semantics:
 * - `expired`   — Stripe checkout session timed out (sessionStatus === 'expired').
 * - `cancelled` — Human-initiated cancel (set elsewhere; NOT returned here).
 * - `paid`      — Session complete and payment captured (or no payment required).
 * - `pending`   — Everything else (unpaid, in-progress, etc.).
 *
 * Note: this matches the Stripe webhook's existing behavior for
 * `checkout.session.expired`. The `/api/order/sync` route previously mapped
 * expired sessions to `cancelled`; that was a bug and has been unified here.
 */
export function mapPaymentStatusToOrderStatus(
  paymentStatus: string | null,
  sessionStatus: string | null
): OrderStatus {
  if (sessionStatus === 'complete' && paymentStatus === 'paid') {
    return 'paid';
  }
  if (sessionStatus === 'complete' && paymentStatus === 'no_payment_required') {
    return 'paid';
  }
  if (sessionStatus === 'expired') {
    return 'expired';
  }
  if (paymentStatus === 'unpaid' || paymentStatus === 'no_payment_required') {
    return 'pending';
  }
  return 'pending';
}
