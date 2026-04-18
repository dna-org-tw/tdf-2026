import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stayStripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' })
  : null;

export async function findOrCreateStayCustomer(customerEmail: string) {
  if (!stayStripe) throw new Error('stripe_not_configured');
  const existing = await stayStripe.customers.list({ email: customerEmail, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stayStripe.customers.create({ email: customerEmail });
}

export async function createStaySetupIntent(customerEmail: string) {
  if (!stayStripe) throw new Error('stripe_not_configured');
  const customer = await findOrCreateStayCustomer(customerEmail);
  const setupIntent = await stayStripe.setupIntents.create({
    customer: customer.id,
    usage: 'off_session',
    payment_method_types: ['card'],
  });
  return { customer, setupIntent };
}

export async function chargeStayNoShow(input: {
  customerId: string;
  paymentMethodId: string;
  amountTwd: number;
  statementDescriptorSuffix: string;
}) {
  if (!stayStripe) throw new Error('stripe_not_configured');
  return stayStripe.paymentIntents.create({
    amount: input.amountTwd * 100,
    currency: 'twd',
    customer: input.customerId,
    payment_method: input.paymentMethodId,
    off_session: true,
    confirm: true,
    statement_descriptor_suffix: input.statementDescriptorSuffix,
  });
}
