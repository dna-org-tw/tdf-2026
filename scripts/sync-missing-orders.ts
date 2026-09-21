/**
 * 一次性同步：
 * 1. 補齊 6 筆缺少的 TDF paid sessions
 * 2. 修正 14 筆 ch_ 訂單的付款資訊
 */

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

const stripeKey = process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY!;
const stripe = new Stripe(stripeKey, { apiVersion: '2025-12-15.clover' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// 6 筆缺少的 TDF paid sessions
const MISSING_SESSIONS = [
  { id: 'cs_live_b1gto1TFuwPPuieAkrdw5zoA4rDTwu9QPPZ7240FlsP5SADwgSYrmsGbD7', tier: 'weekly_backer' },
  { id: 'cs_live_b17yKjI6umrCXLkhS1easTM7wQQM9kdzZQK3Ws3E6Ap4BK48osuoZB4loo', tier: 'weekly_backer' },
  { id: 'cs_live_b1pHWS2toVUbBV5u4AtAN4ItdNYGPlA3ohWRuwVLWb0Hdp8YFC3HJlh5wC', tier: 'weekly_backer' },
  { id: 'cs_live_b14MZT6r3QlCQzxnS086glqPFAqRmsE0r074LPERjqUOKIaLwRw973B4vm', tier: 'weekly_backer' },
  { id: 'cs_live_b1mqG2y8Xte25ve684WJ5wt4dtX1sV2f5QZYQOFBYCSSrktB0JrqWEivg1', tier: 'contribute' },
  { id: 'cs_live_b1w6kJ3hbo6NtkdJXLfehOtKnsJHuQnT6orri7S1OETKOLMQUNNmshSdyl', tier: 'backer' },
] as const;

// 14 筆需要修正的 ch_ 訂單（排除找不到的 ch_3SqSwdB0e5oBVi8T0mNEkXZG）
const CH_ORDERS_TO_FIX = [
  'ch_3SrBpjB0e5oBVi8T0T3TH1mf',
  'ch_3Sr9GHB0e5oBVi8T1fU8kpiy',
  'ch_3Sqxq7B0e5oBVi8T1PjOFcHT',
  'ch_3Sqqw7B0e5oBVi8T0oU7tDQw',
  'ch_3SqquZB0e5oBVi8T1cJr8DCe',
  'ch_3SqquRB0e5oBVi8T1Z3eJH5p',
  'ch_3SqqqoB0e5oBVi8T15rj1MDE',
  'ch_3SqqiKB0e5oBVi8T1pLb0Ngb',
  'ch_3SqVmnB0e5oBVi8T1wpAkL2P',
  'ch_3SqU7pB0e5oBVi8T15Q8h5qR',
  'ch_3SqU5OB0e5oBVi8T0ryVEieu',
  'ch_3SqU19B0e5oBVi8T057dk1C5',
  'ch_3SqRe6B0e5oBVi8T07eYHmlC',
  'ch_3SqRITB0e5oBVi8T1GVdQALs',
];

async function syncMissingSessions() {
  console.log('=== 1. 補齊 6 筆缺少的 TDF paid sessions ===\n');

  let created = 0;
  let failed = 0;

  for (const { id, tier } of MISSING_SESSIONS) {
    try {
      const session = await stripe.checkout.sessions.retrieve(id, {
        expand: ['payment_intent', 'payment_intent.latest_charge', 'line_items'],
      });

      const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;
      let charge: Stripe.Charge | null = null;

      if (paymentIntent?.latest_charge) {
        const chargeId = typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge.id;
        try { charge = await stripe.charges.retrieve(chargeId); } catch { /* ignore */ }
      }

      const customerDetails = session.customer_details;
      const customerAddress = customerDetails?.address
        ? {
            line1: customerDetails.address.line1 || null,
            line2: customerDetails.address.line2 || null,
            city: customerDetails.address.city || null,
            state: customerDetails.address.state || null,
            postal_code: customerDetails.address.postal_code || null,
            country: customerDetails.address.country || null,
          }
        : null;

      let status: string;
      if (session.status === 'complete' && session.payment_status === 'paid') status = 'paid';
      else if (session.status === 'expired') status = 'expired';
      else status = 'pending';

      const { error } = await supabase.from('orders').insert({
        stripe_session_id: id,
        stripe_payment_intent_id: paymentIntent?.id || null,
        ticket_tier: tier,
        status,
        amount_subtotal: session.amount_subtotal || 0,
        amount_total: session.amount_total || 0,
        amount_tax: session.total_details?.amount_tax || 0,
        amount_discount: session.total_details?.amount_discount || 0,
        currency: session.currency || 'usd',
        customer_email: customerDetails?.email || null,
        customer_name: customerDetails?.name || null,
        customer_phone: customerDetails?.phone || null,
        customer_address: customerAddress,
        payment_method_brand: charge?.payment_method_details?.card?.brand || null,
        payment_method_last4: charge?.payment_method_details?.card?.last4 || null,
        payment_method_type: charge?.payment_method_details?.type || null,
      });

      if (error) {
        console.log(`  ❌ ${id.slice(0, 30)}... | ${error.message}`);
        failed++;
      } else {
        console.log(`  ✅ ${id.slice(0, 30)}... | ${tier} | ${status} | $${((session.amount_total || 0) / 100).toFixed(2)} | ${customerDetails?.email || '(none)'}`);
        created++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ ${id.slice(0, 30)}... | ${msg}`);
      failed++;
    }
  }

  console.log(`\n新建: ${created} | 失敗: ${failed}\n`);
}

async function fixChOrders() {
  console.log('=== 2. 修正 14 筆 ch_ 訂單付款資訊 ===\n');

  let fixed = 0;
  let failed = 0;

  for (const chargeId of CH_ORDERS_TO_FIX) {
    try {
      const charge = await stripe.charges.retrieve(chargeId);

      const updateData: Record<string, unknown> = {
        stripe_payment_intent_id: typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : (charge.payment_intent as Stripe.PaymentIntent | null)?.id || null,
        payment_method_brand: charge.payment_method_details?.card?.brand || null,
        payment_method_last4: charge.payment_method_details?.card?.last4 || null,
        payment_method_type: charge.payment_method_details?.type || null,
        updated_at: new Date().toISOString(),
      };

      // 補齊 name（只在 Supabase 為空時更新）
      if (charge.billing_details?.name) {
        updateData.customer_name = charge.billing_details.name;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('stripe_session_id', chargeId);

      if (error) {
        console.log(`  ❌ ${chargeId} | ${error.message}`);
        failed++;
      } else {
        const brand = charge.payment_method_details?.card?.brand || '';
        const last4 = charge.payment_method_details?.card?.last4 || '';
        const name = charge.billing_details?.name || '';
        console.log(`  ✅ ${chargeId} | ${brand} *${last4}${name ? ` | name: ${name}` : ''}`);
        fixed++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ ${chargeId} | ${msg}`);
      failed++;
    }
  }

  console.log(`\n修正: ${fixed} | 失敗: ${failed}\n`);
}

async function printSummary() {
  console.log('=== 最終統計 ===\n');

  const { data: orders } = await supabase.from('orders').select('status');
  if (!orders) return;

  const counts: Record<string, number> = {};
  for (const o of orders) counts[o.status] = (counts[o.status] || 0) + 1;

  for (const [s, c] of Object.entries(counts).sort()) console.log(`  ${s}: ${c}`);
  console.log(`  total: ${orders.length}`);
}

async function main() {
  await syncMissingSessions();
  await fixChOrders();
  await printSummary();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
