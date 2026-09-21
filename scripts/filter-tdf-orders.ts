/**
 * 過濾 TDF 2026 訂單，比對 Stripe 與 Supabase
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

// TDF 2026 price IDs from .env.local
const TDF_PRICE_IDS = new Set([
  process.env.STRIPE_PRICE_EXPLORE?.trim(),
  process.env.STRIPE_PRICE_CONTRIBUTE?.trim(),
  process.env.STRIPE_PRICE_WEEKLY_BACKER?.trim(),
  process.env.STRIPE_PRICE_BACKER?.trim(),
].filter(Boolean));

async function main() {
  // === 1. 列出 Stripe 所有 products & prices ===
  console.log('=== 1. Stripe Products & Prices ===\n');

  const prices: Stripe.Price[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;
  while (hasMore) {
    const params: Stripe.PriceListParams = { limit: 100, expand: ['data.product'] };
    if (startingAfter) params.starting_after = startingAfter;
    const result = await stripe.prices.list(params);
    prices.push(...result.data);
    hasMore = result.has_more;
    if (result.data.length > 0) startingAfter = result.data[result.data.length - 1].id;
  }

  for (const p of prices) {
    const product = p.product as Stripe.Product;
    const isTDF = TDF_PRICE_IDS.has(p.id);
    console.log(`${isTDF ? '✅ TDF' : '   ---'} ${p.id} | $${((p.unit_amount || 0) / 100).toFixed(2)} ${p.currency} | ${product.name}`);
  }

  console.log(`\nTDF Price IDs configured: ${[...TDF_PRICE_IDS].join(', ')}`);

  // === 2. 取得所有 paid checkout sessions 及其 line items ===
  console.log('\n=== 2. 分類 Stripe Checkout Sessions (paid) ===\n');

  const allSessions: Stripe.Checkout.Session[] = [];
  hasMore = true;
  startingAfter = undefined;
  while (hasMore) {
    const params: Stripe.Checkout.SessionListParams = {
      limit: 100,
      expand: ['data.line_items', 'data.payment_intent'],
    };
    if (startingAfter) params.starting_after = startingAfter;
    const result = await stripe.checkout.sessions.list(params);
    allSessions.push(...result.data);
    hasMore = result.has_more;
    if (result.data.length > 0) startingAfter = result.data[result.data.length - 1].id;
  }

  const paidSessions = allSessions.filter((s) => s.payment_status === 'paid');

  const tdfSessions: Stripe.Checkout.Session[] = [];
  const otherSessions: Stripe.Checkout.Session[] = [];

  for (const session of paidSessions) {
    const lineItems = session.line_items?.data || [];
    const priceIds = lineItems.map((li) => {
      const price = li.price;
      return price?.id;
    }).filter(Boolean);

    // Check success_url for TDF pattern
    const isTDFUrl = session.success_url?.includes('/checkout/success') || false;
    const isTDFPrice = priceIds.some((pid) => TDF_PRICE_IDS.has(pid!));
    // Also check metadata for tier
    const hasTier = session.success_url?.match(/tier=(explore|contribute|weekly_backer|little_backer|backer)/);

    if (isTDFPrice || isTDFUrl || hasTier) {
      tdfSessions.push(session);
    } else {
      otherSessions.push(session);
    }
  }

  console.log(`Paid sessions total: ${paidSessions.length}`);
  console.log(`  TDF 2026: ${tdfSessions.length}`);
  console.log(`  其他活動: ${otherSessions.length}`);

  if (otherSessions.length > 0) {
    console.log('\n--- 其他活動的 paid sessions ---');
    for (const s of otherSessions) {
      const lineItems = s.line_items?.data || [];
      const desc = lineItems.map((li) => `${li.description} ($${((li.amount_total || 0) / 100).toFixed(2)})`).join(', ');
      console.log(`  ${s.id} | ${s.customer_details?.email || '(none)'} | ${desc || '(no items)'}`);
    }
  }

  // === 3. 比對 TDF paid sessions vs Supabase ===
  console.log('\n=== 3. TDF 2026 Paid Sessions vs Supabase ===\n');

  const { data: orders } = await supabase.from('orders').select('*');
  const orderBySession = new Map((orders || []).map((o) => [o.stripe_session_id, o]));
  const orderByPI = new Map(
    (orders || []).filter((o) => o.stripe_payment_intent_id).map((o) => [o.stripe_payment_intent_id, o]),
  );

  const missingTDF: Stripe.Checkout.Session[] = [];
  const matchedTDF: { session: Stripe.Checkout.Session; order: any }[] = [];

  for (const session of tdfSessions) {
    const pi = session.payment_intent as Stripe.PaymentIntent | null;
    const order = orderBySession.get(session.id) || (pi ? orderByPI.get(pi.id) : null);

    if (order) {
      matchedTDF.push({ session, order });
    } else {
      missingTDF.push(session);
    }
  }

  console.log(`TDF paid sessions: ${tdfSessions.length}`);
  console.log(`  已在 Supabase: ${matchedTDF.length}`);
  console.log(`  Supabase 缺少: ${missingTDF.length}`);

  if (missingTDF.length > 0) {
    console.log('\n--- Supabase 缺少的 TDF paid sessions ---');
    for (const s of missingTDF) {
      const lineItems = s.line_items?.data || [];
      const desc = lineItems.map((li) => `${li.description}`).join(', ');
      const tier = s.success_url?.match(/tier=(\w+)/)?.[1] || '(unknown)';
      console.log(`  ${s.id} | tier=${tier} | $${((s.amount_total || 0) / 100).toFixed(2)} | ${s.customer_details?.email || '(none)'} | ${desc}`);
    }
  }

  // === 4. 檢查 ch_ 訂單 — 用 charges 比對 ===
  console.log('\n=== 4. Stripe Charges 分類 ===\n');

  const allCharges: Stripe.Charge[] = [];
  hasMore = true;
  startingAfter = undefined;
  while (hasMore) {
    const params: Stripe.ChargeListParams = { limit: 100 };
    if (startingAfter) params.starting_after = startingAfter;
    const result = await stripe.charges.list(params);
    allCharges.push(...result.data);
    hasMore = result.has_more;
    if (result.data.length > 0) startingAfter = result.data[result.data.length - 1].id;
  }

  // 找出哪些 charge 對應到 TDF sessions
  const tdfSessionPIs = new Set(
    tdfSessions
      .map((s) => {
        const pi = s.payment_intent;
        return typeof pi === 'string' ? pi : pi?.id;
      })
      .filter(Boolean),
  );

  // 找出所有 session 的 PI（含未付款的）
  const allSessionPIs = new Set(
    allSessions
      .map((s) => {
        const pi = s.payment_intent;
        return typeof pi === 'string' ? pi : pi?.id;
      })
      .filter(Boolean),
  );

  const tdfCharges: Stripe.Charge[] = [];
  const otherCharges: Stripe.Charge[] = [];
  const orphanCharges: Stripe.Charge[] = []; // charges without a matching session

  for (const charge of allCharges) {
    if (charge.status !== 'succeeded') continue;
    const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;

    if (piId && tdfSessionPIs.has(piId)) {
      tdfCharges.push(charge);
    } else if (piId && allSessionPIs.has(piId)) {
      // belongs to some session but not TDF
      otherCharges.push(charge);
    } else {
      // No matching session — could be payment link or direct charge
      orphanCharges.push(charge);
    }
  }

  console.log(`Succeeded charges: ${allCharges.filter((c) => c.status === 'succeeded').length}`);
  console.log(`  TDF (有對應 session): ${tdfCharges.length}`);
  console.log(`  其他活動 (有對應 session): ${otherCharges.length}`);
  console.log(`  無對應 session (Payment Link / 直接收款): ${orphanCharges.length}`);

  if (orphanCharges.length > 0) {
    console.log('\n--- 無對應 session 的 charges ---');
    for (const c of orphanCharges) {
      const piId = typeof c.payment_intent === 'string' ? c.payment_intent : c.payment_intent?.id;
      console.log(`  ${c.id} | $${(c.amount / 100).toFixed(2)} ${c.currency} | ${c.billing_details?.email || c.receipt_email || '(none)'} | PI: ${piId || '(none)'}`);
    }
  }

  // === 5. Supabase 中有但 Stripe TDF 沒有的訂單（可能是其他活動混入）===
  console.log('\n=== 5. Supabase orders 中可能不屬於 TDF 的 ===\n');

  const tdfSessionIds = new Set(tdfSessions.map((s) => s.id));
  const allSessionIds = new Set(allSessions.map((s) => s.id));
  const tdfChargeIds = new Set(tdfCharges.map((c) => c.id));

  const chOrders = (orders || []).filter((o) => o.stripe_session_id.startsWith('ch_'));
  const nonTDFInSupabase = chOrders.filter((o) => {
    // Check if this charge matches a TDF charge
    return !tdfChargeIds.has(o.stripe_session_id);
  });

  if (nonTDFInSupabase.length > 0) {
    console.log(`ch_ 訂單中可能不屬於 TDF: ${nonTDFInSupabase.length}`);
    for (const o of nonTDFInSupabase) {
      const matchedCharge = orphanCharges.find((c) => c.id === o.stripe_session_id);
      console.log(`  ${o.stripe_session_id} | ${o.ticket_tier} | $${(o.amount_total / 100).toFixed(2)} | ${o.customer_email || '(none)'} | Stripe match: ${matchedCharge ? 'orphan charge' : 'not found'}`);
    }
  } else {
    console.log('所有 ch_ 訂單都對應到 TDF');
  }

  // === 總結 ===
  console.log('\n========== 總結 ==========\n');
  console.log(`Stripe TDF 2026 paid sessions: ${tdfSessions.length}`);
  console.log(`  已在 Supabase: ${matchedTDF.length}`);
  console.log(`  缺少: ${missingTDF.length}`);
  console.log(`\nStripe 無對應 session 的 charges: ${orphanCharges.length} (可能來自 Payment Links 或其他活動)`);
  console.log(`Supabase ch_ 訂單: ${chOrders.length}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
