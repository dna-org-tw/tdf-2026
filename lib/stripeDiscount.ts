import type Stripe from 'stripe';

export interface ExtractedDiscount {
  discount_code: string | null;
  discount_promotion_code_id: string | null;
  discount_coupon_id: string | null;
}

const EMPTY: ExtractedDiscount = {
  discount_code: null,
  discount_promotion_code_id: null,
  discount_coupon_id: null,
};

function asId(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && ref !== null && 'id' in ref) {
    const id = (ref as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

/**
 * Pull the applied promotion code / coupon from a Checkout Session.
 *
 * Webhook event payloads do NOT include `total_details.breakdown` by default,
 * so when `amount_discount > 0` we re-retrieve the session with the breakdown
 * and promotion_code expanded. Returns empty values if nothing was applied.
 */
export async function extractSessionDiscount(
  sessionOrId: Stripe.Checkout.Session | string,
  stripe: Stripe
): Promise<ExtractedDiscount> {
  const base =
    typeof sessionOrId === 'string'
      ? null
      : sessionOrId;

  if (base && !base.total_details?.amount_discount) {
    return EMPTY;
  }

  const sessionId = typeof sessionOrId === 'string' ? sessionOrId : base?.id;
  if (!sessionId) return EMPTY;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['total_details.breakdown.discounts.discount.promotion_code'],
    });
  } catch (err) {
    console.error('[stripeDiscount] Failed to retrieve session', sessionId, err);
    return EMPTY;
  }

  const discounts = session.total_details?.breakdown?.discounts;
  if (!discounts || discounts.length === 0) return EMPTY;

  const first = discounts[0]?.discount;
  if (!first) return EMPTY;

  const couponId = asId((first as unknown as { coupon?: unknown }).coupon);

  const promoRef = (first as unknown as { promotion_code?: unknown }).promotion_code;
  let promoId: string | null = null;
  let code: string | null = null;

  if (typeof promoRef === 'string') {
    promoId = promoRef;
  } else if (promoRef && typeof promoRef === 'object') {
    const p = promoRef as { id?: unknown; code?: unknown };
    promoId = typeof p.id === 'string' ? p.id : null;
    code = typeof p.code === 'string' ? p.code : null;
  }

  if (promoId && !code) {
    try {
      const promo = await stripe.promotionCodes.retrieve(promoId);
      code = promo.code ?? null;
    } catch (err) {
      console.error('[stripeDiscount] Failed to retrieve promotion code', promoId, err);
    }
  }

  return {
    discount_code: code,
    discount_promotion_code_id: promoId,
    discount_coupon_id: couponId,
  };
}
