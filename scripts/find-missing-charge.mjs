import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Search for charges with Luma metadata email = bethanyruhl@gmail.com
const r = await stripe.charges.search({
  query: `metadata["email"]:"bethanyruhl@gmail.com"`,
  limit: 20,
});
console.log('charges with metadata.email=bethanyruhl:', r.data.map(c => ({
  id: c.id, amount: c.amount, status: c.status, pi: c.payment_intent,
  billing: c.billing_details?.email, created: new Date(c.created*1000).toISOString(),
  metadata: c.metadata,
})));

// Also search by billing email
const r2 = await stripe.charges.search({
  query: `billing_details.email:"bethanyruhl@gmail.com"`,
  limit: 20,
});
console.log('\ncharges with billing.email=bethanyruhl:', r2.data.map(c => ({
  id: c.id, amount: c.amount, status: c.status, pi: c.payment_intent,
  created: new Date(c.created*1000).toISOString(), metadata: c.metadata,
})));
