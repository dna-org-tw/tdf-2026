/**
 * 使用 Live Stripe key 比對 Stripe 交易與 Supabase orders
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const stripeKey = process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY!;
const stripe = new Stripe(stripeKey, { apiVersion: '2025-12-15.clover' });

async function main() {
  // === 1. 從 Stripe Live 取得所有 checkout sessions ===
  console.log('=== 1. 取得 Stripe Live Checkout Sessions ===\n');
  const stripeSessions: Stripe.Checkout.Session[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Stripe.Checkout.SessionListParams = {
      limit: 100,
      expand: ['data.payment_intent'],
    };
    if (startingAfter) params.starting_after = startingAfter;
    const result = await stripe.checkout.sessions.list(params);
    stripeSessions.push(...result.data);
    hasMore = result.has_more;
    if (result.data.length > 0) startingAfter = result.data[result.data.length - 1].id;
  }
  console.log(`Stripe Checkout Sessions: ${stripeSessions.length}`);

  // === 2. 從 Stripe Live 取得所有 charges (含非 checkout 的) ===
  console.log('\n=== 2. 取�� Stripe Live Charges ===\n');
  const stripeCharges: Stripe.Charge[] = [];
  hasMore = true;
  startingAfter = undefined;

  while (hasMore) {
    const params: Stripe.ChargeListParams = { limit: 100 };
    if (startingAfter) params.starting_after = startingAfter;
    const result = await stripe.charges.list(params);
    stripeCharges.push(...result.data);
    hasMore = result.has_more;
    if (result.data.length > 0) startingAfter = result.data[result.data.length - 1].id;
  }
  console.log(`Stripe Charges: ${stripeCharges.length}`);

  // === 3. 從 Stripe Live 取得所有 payment intents ===
  console.log('\n=== 3. 取得 Stripe Live Payment Intents ===\n');
  const stripePaymentIntents: Stripe.PaymentIntent[] = [];
  hasMore = true;
  startingAfter = undefined;

  while (hasMore) {
    const params: Stripe.PaymentIntentListParams = { limit: 100 };
    if (startingAfter) params.starting_after = startingAfter;
    const result = await stripe.paymentIntents.list(params);
    stripePaymentIntents.push(...result.data);
    hasMore = result.has_more;
    if (result.data.length > 0) startingAfter = result.data[result.data.length - 1].id;
  }
  console.log(`Stripe Payment Intents: ${stripePaymentIntents.length}`);

  // === 4. 取得 Supabase orders ===
  console.log('\n=== 4. 取得 Supabase Orders ===\n');
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (!orders) {
    console.error('查詢 Supabase 失敗');
    return;
  }
  console.log(`Supabase Orders: ${orders.length}`);

  const orderBySessionId = new Map(orders.map((o) => [o.stripe_session_id, o]));
  const orderByPaymentIntent = new Map(
    orders.filter((o) => o.stripe_payment_intent_id).map((o) => [o.stripe_payment_intent_id, o]),
  );

  // === 5. 比對 Checkout Sessions ===
  console.log('\n=== 5. 比對 Stripe Checkout Sessions → Supabase ===\n');

  const sessionsMissing: Stripe.Checkout.Session[] = [];
  const sessionsMatched: { session: Stripe.Checkout.Session; order: typeof orders[0] }[] = [];
  const sessionsMismatch: { session: Stripe.Checkout.Session; order: typeof orders[0]; issues: string[] }[] = [];

  for (const session of stripeSessions) {
    const order = orderBySessionId.get(session.id);
    const pi = session.payment_intent as Stripe.PaymentIntent | null;
    const piOrder = pi ? orderByPaymentIntent.get(pi.id) : null;
    const matched = order || piOrder;

    if (!matched) {
      sessionsMissing.push(session);
      continue;
    }

    const issues: string[] = [];

    // 狀態比對
    let expectedStatus: string;
    if (session.status === 'complete' && session.payment_status === 'paid') expectedStatus = 'paid';
    else if (session.status === 'expired') expectedStatus = 'expired';
    else expectedStatus = 'pending';

    if (matched.status !== expectedStatus && matched.status !== 'cancelled') {
      issues.push(`status: Stripe=${expectedStatus}, Supabase=${matched.status}`);
    }

    // 金額比對
    if (session.amount_total && matched.amount_total !== session.amount_total) {
      issues.push(`amount: Stripe=${session.amount_total}, Supabase=${matched.amount_total}`);
    }

    // Email 比對
    const stripeEmail = session.customer_details?.email;
    if (stripeEmail && matched.customer_email !== stripeEmail) {
      issues.push(`email: Stripe=${stripeEmail}, Supabase=${matched.customer_email || '(none)'}`);
    }

    if (issues.length > 0) {
      sessionsMismatch.push({ session, order: matched, issues });
    } else {
      sessionsMatched.push({ session, order: matched });
    }
  }

  console.log(`匹配: ${sessionsMatched.length} | 不一致: ${sessionsMismatch.length} | Supabase 缺少: ${sessionsMissing.length}`);

  if (sessionsMissing.length > 0) {
    console.log('\n--- Supabase 缺少的 Sessions ---');
    for (const s of sessionsMissing) {
      const pi = s.payment_intent as Stripe.PaymentIntent | null;
      console.log(`  ${s.id} | ${s.status}/${s.payment_status} | $${((s.amount_total || 0) / 100).toFixed(2)} | ${s.customer_details?.email || '(none)'} | PI: ${pi?.id || '(none)'}`);
    }
  }

  if (sessionsMismatch.length > 0) {
    console.log('\n--- 資料不一致的 Sessions ---');
    for (const { session, order, issues } of sessionsMismatch) {
      console.log(`  ${session.id}`);
      for (const issue of issues) {
        console.log(`    ⚠️  ${issue}`);
      }
    }
  }

  // === 6. 比對 Charges (ch_) ===
  console.log('\n=== 6. 比對 Stripe Charges → Supabase ch_ 訂單 ===\n');

  const chOrders = orders.filter((o) => o.stripe_session_id.startsWith('ch_'));
  console.log(`Supabase ch_ 訂單: ${chOrders.length}`);

  let chMatched = 0;
  let chMissing = 0;
  let chFixed: string[] = [];

  for (const order of chOrders) {
    const charge = stripeCharges.find((c) => c.id === order.stripe_session_id);
    if (!charge) {
      console.log(`  ❌ ${order.stripe_session_id} — Stripe 找不到 (email: ${order.customer_email})`);
      chMissing++;
      continue;
    }

    chMatched++;
    const issues: string[] = [];

    // 比對資料
    if (charge.status === 'succeeded' && order.status !== 'paid') {
      issues.push(`status: Stripe=paid, Supabase=${order.status}`);
    }
    if (charge.amount && order.amount_total !== charge.amount) {
      issues.push(`amount: Stripe=${charge.amount}, Supabase=${order.amount_total}`);
    }

    const chargeEmail = charge.billing_details?.email || charge.receipt_email;
    if (chargeEmail && order.customer_email !== chargeEmail) {
      issues.push(`email: Stripe=${chargeEmail}, Supabase=${order.customer_email}`);
    }

    if (!order.customer_name && charge.billing_details?.name) {
      issues.push(`name missing in Supabase, Stripe has: ${charge.billing_details.name}`);
    }
    if (!order.payment_method_type && charge.payment_method_details?.type) {
      issues.push(`payment_method missing in Supabase`);
    }

    if (issues.length > 0) {
      console.log(`  ⚠️  ${order.stripe_session_id}`);
      for (const issue of issues) console.log(`       ${issue}`);
      chFixed.push(order.stripe_session_id);
    } else {
      console.log(`  ✅ ${order.stripe_session_id} — 資料一致`);
    }
  }

  console.log(`\n匹配: ${chMatched} | 找不到: ${chMissing}`);

  // === 7. 反向檢查：Stripe 有但 Supabase 沒有的 succeeded charges ===
  console.log('\n=== 7. Stripe 有但 Supabase 完全沒有的已付款交易 ===\n');

  const allSupabaseSessionIds = new Set(orders.map((o) => o.stripe_session_id));
  const allSupabaseEmails = new Set(orders.filter((o) => o.customer_email).map((o) => o.customer_email));

  // Check charges not in Supabase
  const missingCharges = stripeCharges.filter(
    (c) => c.status === 'succeeded' && !allSupabaseSessionIds.has(c.id),
  );

  // Check sessions not in Supabase (paid ones)
  const missingSessions = stripeSessions.filter(
    (s) => s.payment_status === 'paid' && !allSupabaseSessionIds.has(s.id),
  );

  if (missingCharges.length === 0 && missingSessions.length === 0) {
    console.log('✅ 所有 Stripe 已付款交易都有對應 Supabase 訂單');
  } else {
    if (missingSessions.length > 0) {
      console.log(`Paid Sessions 缺少 ${missingSessions.length} 筆:`);
      for (const s of missingSessions) {
        console.log(`  ${s.id} | $${((s.amount_total || 0) / 100).toFixed(2)} | ${s.customer_details?.email || '(none)'}`);
      }
    }
    if (missingCharges.length > 0) {
      console.log(`Succeeded Charges 缺少 ${missingCharges.length} 筆:`);
      for (const c of missingCharges) {
        console.log(`  ${c.id} | $${(c.amount / 100).toFixed(2)} | ${c.billing_details?.email || c.receipt_email || '(none)'}`);
      }
    }
  }

  // === 總結 ===
  console.log('\n========== 總結 ==========\n');
  console.log(`Stripe Live:`);
  console.log(`  Checkout Sessions: ${stripeSessions.length} (paid: ${stripeSessions.filter((s) => s.payment_status === 'paid').length})`);
  console.log(`  Charges: ${stripeCharges.length} (succeeded: ${stripeCharges.filter((c) => c.status === 'succeeded').length})`);
  console.log(`  Payment Intents: ${stripePaymentIntents.length}`);
  console.log(`\nSupabase:`);
  console.log(`  Orders: ${orders.length} (paid: ${orders.filter((o) => o.status === 'paid').length})`);

  const supabasePaidEmails = new Set(orders.filter((o) => o.status === 'paid').map((o) => o.customer_email));
  const stripePaidEmails = new Set([
    ...stripeSessions.filter((s) => s.payment_status === 'paid').map((s) => s.customer_details?.email),
    ...stripeCharges.filter((c) => c.status === 'succeeded').map((c) => c.billing_details?.email || c.receipt_email),
  ].filter(Boolean));

  console.log(`\n  Stripe 已付款 unique emails: ${stripePaidEmails.size}`);
  console.log(`  Supabase paid unique emails: ${supabasePaidEmails.size}`);
}

main().catch((err) => {
  console.error('執行失敗:', err);
  process.exit(1);
});
