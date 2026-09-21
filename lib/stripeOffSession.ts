import Stripe from 'stripe';

// Shared off-session Stripe helpers for "save card, charge later" flows.
// Currently used by stay-booking (via lib/stayStripe.ts) and event-confirmation.
// Both flows need: find-or-create customer, create SetupIntent, charge off-session.

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripeOffSession = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' })
  : null;

export type SavedCardInfo = {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

export function extractCardInfo(pm: Stripe.PaymentMethod | string | null | undefined): SavedCardInfo {
  if (!pm || typeof pm === 'string' || !pm.card) {
    return { brand: null, last4: null, expMonth: null, expYear: null };
  }
  return {
    brand: pm.card.brand ?? null,
    last4: pm.card.last4 ?? null,
    expMonth: pm.card.exp_month ?? null,
    expYear: pm.card.exp_year ?? null,
  };
}

export async function findOrCreateOffSessionCustomer(email: string) {
  if (!stripeOffSession) throw new Error('stripe_not_configured');
  const existing = await stripeOffSession.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stripeOffSession.customers.create({ email });
}

export async function createOffSessionSetupIntent(email: string) {
  if (!stripeOffSession) throw new Error('stripe_not_configured');
  const customer = await findOrCreateOffSessionCustomer(email);
  const setupIntent = await stripeOffSession.setupIntents.create({
    customer: customer.id,
    usage: 'off_session',
    payment_method_types: ['card'],
  });
  return { customer, setupIntent };
}

export async function retrieveSetupIntentWithCard(setupIntentId: string) {
  if (!stripeOffSession) throw new Error('stripe_not_configured');
  return stripeOffSession.setupIntents.retrieve(setupIntentId, {
    expand: ['payment_method'],
  });
}

export async function detachPaymentMethod(paymentMethodId: string) {
  if (!stripeOffSession) throw new Error('stripe_not_configured');
  // Stripe returns the detached PaymentMethod object; we don't need it.
  await stripeOffSession.paymentMethods.detach(paymentMethodId);
}

export async function chargeOffSessionTwd(input: {
  customerId: string;
  paymentMethodId: string;
  amountTwd: number;
  statementDescriptorSuffix: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}) {
  if (!stripeOffSession) throw new Error('stripe_not_configured');
  return stripeOffSession.paymentIntents.create(
    {
      amount: input.amountTwd * 100,
      currency: 'twd',
      customer: input.customerId,
      payment_method: input.paymentMethodId,
      off_session: true,
      confirm: true,
      statement_descriptor_suffix: input.statementDescriptorSuffix,
      metadata: input.metadata,
    },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
  );
}
