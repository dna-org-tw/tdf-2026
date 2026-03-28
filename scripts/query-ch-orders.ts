import { readFileSync } from 'fs';
import { resolve } from 'path';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const envPath = resolve(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  if (!process.env[t.slice(0, i)]) process.env[t.slice(0, i)] = t.slice(i + 1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-12-15.clover' });

async function main() {
  // Check if Stripe key is test or live
  const keyPrefix = process.env.STRIPE_SECRET_KEY!.slice(0, 7);
  console.log(`Stripe key mode: ${keyPrefix.includes('test') ? 'TEST' : 'LIVE'}\n`);

  const { data } = await sb
    .from('orders')
    .select('*')
    .like('stripe_session_id', 'ch_%')
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) {
    console.log('No ch_ orders found');
    return;
  }

  console.log(`Found ${data.length} ch_ orders:\n`);
  for (const o of data) {
    console.log(`${o.stripe_session_id}`);
    console.log(`  tier: ${o.ticket_tier} | status: ${o.status} | $${(o.amount_total / 100).toFixed(2)} ${o.currency}`);
    console.log(`  email: ${o.customer_email || '(none)'} | name: ${o.customer_name || '(none)'}`);
    console.log(`  payment_intent: ${o.stripe_payment_intent_id || '(none)'}`);
    console.log(`  created: ${o.created_at}`);
    console.log('');
  }

  // Try looking up one as a payment intent instead
  const sampleId = data[0].stripe_session_id;
  console.log(`--- 嘗試用不同方式查找 ${sampleId} ---\n`);

  // Try as payment intent (pi_ prefix typically, but worth trying)
  try {
    const pi = await stripe.paymentIntents.retrieve(sampleId);
    console.log('Found as PaymentIntent:', pi.id);
  } catch {
    console.log('Not a PaymentIntent');
  }

  // Try searching charges with metadata or by payment intent
  try {
    const charges = await stripe.charges.search({ query: `metadata["charge_id"]:"${sampleId}"`, limit: 1 });
    console.log('Search result:', charges.data.length > 0 ? charges.data[0].id : 'Not found');
  } catch {
    console.log('Charge search not available');
  }
}

main().catch(console.error);
