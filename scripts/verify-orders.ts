/**
 * 驗證 Supabase orders 表狀態：
 * 1. CHECK 約束是否已包含 weekly_backer
 * 2. 所有訂單資料是否完整
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = val;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

async function verifyConstraint() {
  console.log('=== 1. 驗證 CHECK 約束 (weekly_backer) ===\n');

  // 嘗試插入一筆 weekly_backer 測試訂單再刪除
  const testSessionId = `test_constraint_check_${Date.now()}`;
  const { data, error } = await supabase
    .from('orders')
    .insert({
      stripe_session_id: testSessionId,
      ticket_tier: 'weekly_backer',
      status: 'pending',
      amount_subtotal: 0,
      amount_total: 0,
      amount_tax: 0,
      amount_discount: 0,
      currency: 'usd',
    })
    .select()
    .single();

  if (error) {
    console.log('❌ weekly_backer 約束驗證失敗:', error.message);
    if (error.message.includes('check constraint')) {
      console.log('   → CHECK 約束尚未更新，請在 Supabase Dashboard SQL Editor 執行遷移 SQL');
    }
    return false;
  }

  console.log('✅ weekly_backer 約束驗證通過（可成功插入）');

  // 清除測試資料
  await supabase.from('orders').delete().eq('stripe_session_id', testSessionId);
  console.log('   → 測試資料已清除\n');
  return true;
}

async function verifyOrders() {
  console.log('=== 2. 驗證 Supabase 訂單資料 ===\n');

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.log('❌ 查詢訂單失敗:', error.message);
    return;
  }

  console.log(`Supabase 訂單總數: ${orders.length}\n`);

  for (const order of orders) {
    const fields = {
      session_id: order.stripe_session_id?.slice(0, 30) + '...',
      tier: order.ticket_tier,
      status: order.status,
      amount_total: order.amount_total,
      currency: order.currency,
      email: order.customer_email || '(空)',
      name: order.customer_name || '(空)',
      payment_method: order.payment_method_type
        ? `${order.payment_method_brand || ''} *${order.payment_method_last4 || ''} (${order.payment_method_type})`
        : '(空)',
      payment_intent: order.stripe_payment_intent_id ? '✅' : '❌',
    };

    const missingFields: string[] = [];
    if (order.status === 'paid') {
      if (!order.customer_email) missingFields.push('customer_email');
      if (!order.customer_name) missingFields.push('customer_name');
      if (!order.stripe_payment_intent_id) missingFields.push('payment_intent_id');
      if (!order.payment_method_type) missingFields.push('payment_method');
    }

    const statusIcon = order.status === 'paid' ? '💰' : order.status === 'cancelled' ? '🚫' : '⏳';
    console.log(`${statusIcon} [${fields.tier}] ${fields.status} | $${(fields.amount_total / 100).toFixed(2)} ${fields.currency}`);
    console.log(`   Session: ${fields.session_id}`);
    console.log(`   Email: ${fields.email} | Name: ${fields.name}`);
    console.log(`   Payment Intent: ${fields.payment_intent} | Method: ${fields.payment_method}`);

    if (missingFields.length > 0) {
      console.log(`   ⚠️  已付款但缺少欄位: ${missingFields.join(', ')}`);
    }
    console.log('');
  }

  // 統計
  const paid = orders.filter((o) => o.status === 'paid');
  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const pending = orders.filter((o) => o.status === 'pending');
  console.log('--- 統計 ---');
  console.log(`已付款: ${paid.length} | 已取消: ${cancelled.length} | 待處理: ${pending.length}`);

  // 檢查已付款訂單資料完整度
  const paidMissing = paid.filter(
    (o) => !o.customer_email || !o.stripe_payment_intent_id || !o.payment_method_type
  );
  if (paidMissing.length > 0) {
    console.log(`\n⚠️  ${paidMissing.length} 筆已付款訂單資料不完整`);
  } else if (paid.length > 0) {
    console.log(`\n✅ 所有已付款訂單資料完整`);
  }
}

async function verifyStripeSync() {
  console.log('\n=== 3. 比對 Stripe 與 Supabase ===\n');

  // 取得所有 Stripe sessions
  const stripeSessions: Stripe.Checkout.Session[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Stripe.Checkout.SessionListParams = { limit: 100 };
    if (startingAfter) params.starting_after = startingAfter;
    const result = await stripe.checkout.sessions.list(params);
    stripeSessions.push(...result.data);
    hasMore = result.has_more;
    if (result.data.length > 0) startingAfter = result.data[result.data.length - 1].id;
  }

  // 取得所有 Supabase orders
  const { data: orders } = await supabase.from('orders').select('stripe_session_id, status');
  const orderMap = new Map((orders || []).map((o) => [o.stripe_session_id, o.status]));

  let missingInSupabase = 0;
  let statusMismatch = 0;

  for (const session of stripeSessions) {
    const supabaseStatus = orderMap.get(session.id);

    if (!supabaseStatus) {
      console.log(`❌ Stripe session ${session.id} 不在 Supabase 中`);
      missingInSupabase++;
      continue;
    }

    // 比對狀態
    let expectedStatus: string;
    if (session.status === 'complete' && session.payment_status === 'paid') {
      expectedStatus = 'paid';
    } else if (session.status === 'expired') {
      expectedStatus = 'cancelled';
    } else {
      expectedStatus = 'pending';
    }

    if (supabaseStatus !== expectedStatus) {
      console.log(`⚠️  狀態不一致 ${session.id}: Stripe=${expectedStatus}, Supabase=${supabaseStatus}`);
      statusMismatch++;
    }
  }

  console.log(`Stripe sessions 總數: ${stripeSessions.length}`);
  console.log(`Supabase orders 總數: ${orderMap.size}`);
  console.log(`缺少的訂單: ${missingInSupabase}`);
  console.log(`狀態不一致: ${statusMismatch}`);

  if (missingInSupabase === 0 && statusMismatch === 0) {
    console.log('\n✅ Stripe 與 Supabase 完全同步');
  }
}

async function main() {
  await verifyConstraint();
  await verifyOrders();
  await verifyStripeSync();
}

main().catch((err) => {
  console.error('驗證失敗:', err);
  process.exit(1);
});
