import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const orderIds = [
  '21da9ffe-48f0-48d6-b7d7-c481c081c898', // bethanyruhl@gmail.com
  'f6d354cb-23da-4ec3-af6b-913cd27a8ed9', // thebzone@gmail.com
];

for (const id of orderIds) {
  const { data } = await sb.from('orders').select('*').eq('id', id).single();
  console.log('\n== DB order', id);
  console.log({
    email: data.customer_email, tier: data.ticket_tier, status: data.status,
    ssid: data.stripe_session_id, pi: data.stripe_payment_intent_id,
    amount: data.amount_total, created: data.created_at,
  });
}

const charges = ['ch_3SqSwdB0e5oBVi8T0mNEkXZG', 'ch_3SqRe6B0e5oBVi8T07eYHmlC'];
for (const c of charges) {
  try {
    const ch = await stripe.charges.retrieve(c);
    console.log('\n== Charge', c);
    console.log({ status: ch.status, paid: ch.paid, amount: ch.amount, pi: ch.payment_intent, email: ch.billing_details?.email, receipt_email: ch.receipt_email, created: new Date(ch.created * 1000).toISOString(), metadata: ch.metadata });
    if (ch.payment_intent) {
      const sessions = await stripe.checkout.sessions.list({ payment_intent: ch.payment_intent, limit: 3 });
      console.log('  linked sessions:', sessions.data.map(s => ({ id: s.id, email: s.customer_details?.email, status: s.payment_status, metadata: s.metadata })));
    }
  } catch (e) {
    console.log('\n== Charge', c, 'ERROR:', e.message);
  }
}

// Does thebzone@gmail.com exist as a charge in Stripe at all?
console.log('\n== Search charges for thebzone@gmail.com & bethanyruhl@gmail.com');
for (const email of ['thebzone@gmail.com', 'bethanyruhl@gmail.com']) {
  const r = await stripe.charges.search({ query: `billing_details['email']:'${email}'`, limit: 10 });
  console.log(email, r.data.map(c => ({ id: c.id, amount: c.amount, created: new Date(c.created*1000).toISOString(), pi: c.payment_intent })));
}
