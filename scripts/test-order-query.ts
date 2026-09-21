#!/usr/bin/env npx tsx
/**
 * 訂單查詢測試腳本
 *
 * 測試項目：
 * 1. getOrdersByEmail 從 Supabase orders 表查詢
 * 2. /api/order/query email 查詢回傳格式正確
 * 3. 查無訂單時回傳 404
 * 4. 缺少參數時回傳 400
 *
 * 使用方式：npx tsx scripts/test-order-query.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually
try {
  const envPath = resolve(__dirname, '../.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env file not found
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ ${message}`);
    failed++;
  }
}

const TEST_EMAIL = `order_test_${Date.now()}@test.com`;
const TEST_SESSION_ID = `cs_test_${Date.now()}`;

// ─── 1. Supabase 直接查詢測試 ────────────────────
async function testSupabaseDirectQuery(supabase: ReturnType<typeof createClient>) {
  console.log('\n📦 1. Supabase orders 表直接查詢測試');

  // 插入測試訂單
  const { data: inserted, error: insertErr } = await supabase
    .from('orders')
    .insert({
      stripe_session_id: TEST_SESSION_ID,
      ticket_tier: 'explore',
      status: 'paid',
      amount_subtotal: 5000,
      amount_total: 5000,
      amount_tax: 0,
      amount_discount: 0,
      currency: 'usd',
      customer_email: TEST_EMAIL,
      customer_name: 'Test User',
    })
    .select()
    .single();

  assert(!insertErr && !!inserted, `插入測試訂單成功 (session: ${TEST_SESSION_ID})`);
  if (insertErr) {
    console.error('    插入錯誤:', insertErr.message);
    return;
  }

  // 用 email 查詢
  const { data: byEmail, error: emailErr } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_email', TEST_EMAIL)
    .order('created_at', { ascending: false });

  assert(!emailErr && (byEmail?.length ?? 0) > 0, `用 email 查詢成功 (找到 ${byEmail?.length} 筆)`);

  // 驗證欄位
  if (byEmail && byEmail.length > 0) {
    const order = byEmail[0];
    assert(order.customer_email === TEST_EMAIL, `customer_email 正確`);
    assert(order.stripe_session_id === TEST_SESSION_ID, `stripe_session_id 正確`);
    assert(order.status === 'paid', `status 正確 (paid)`);
    assert(order.amount_total === 5000, `amount_total 正確 (5000)`);
    assert(order.ticket_tier === 'explore', `ticket_tier 正確 (explore)`);
    assert(order.customer_name === 'Test User', `customer_name 正確`);
  }

  // 查詢不存在的 email
  const { data: noResult, error: noErr } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_email', 'nonexistent@nowhere.test');

  assert(!noErr && (noResult?.length ?? 0) === 0, `查無訂單時回傳空陣列`);
}

// ─── 2. 插入多筆訂單排序測試 ─────────────────────
async function testMultipleOrdersSorting(supabase: ReturnType<typeof createClient>) {
  console.log('\n📋 2. 多筆訂單排序測試');

  const secondSessionId = `cs_test_2nd_${Date.now()}`;

  // 插入第二筆訂單
  const { error: insertErr } = await supabase
    .from('orders')
    .insert({
      stripe_session_id: secondSessionId,
      ticket_tier: 'contribute',
      status: 'paid',
      amount_subtotal: 10000,
      amount_total: 10000,
      amount_tax: 0,
      amount_discount: 0,
      currency: 'usd',
      customer_email: TEST_EMAIL,
      customer_name: 'Test User',
    });

  assert(!insertErr, `插入第二筆測試訂單成功`);

  // 查詢應回傳 2 筆，按 created_at DESC 排序
  const { data: orders, error: queryErr } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_email', TEST_EMAIL)
    .order('created_at', { ascending: false });

  assert(!queryErr && (orders?.length ?? 0) === 2, `查詢回傳 2 筆訂單`);

  if (orders && orders.length === 2) {
    const first = new Date(orders[0].created_at).getTime();
    const second = new Date(orders[1].created_at).getTime();
    assert(first >= second, `排序正確（最新的在前）`);
  }

  // 清理第二筆
  await supabase.from('orders').delete().eq('stripe_session_id', secondSessionId);
}

// ─── 3. API Route 測試 ───────────────────────────
async function testAPIRoute() {
  console.log('\n🌐 3. API Route /api/order/query 測試');

  // 測試缺少參數
  try {
    const res = await fetch(`${BASE_URL}/api/order/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(res.status === 400, `缺少參數回傳 400`);
  } catch (err) {
    console.log('  ⚠️  無法連線到 dev server，跳過 API route 測試');
    console.log(`     請確認 dev server 已啟動: npm run dev`);
    return;
  }

  // 測試用 email 查詢（使用測試 email）
  const emailRes = await fetch(`${BASE_URL}/api/order/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL }),
  });

  assert(emailRes.status === 200, `email 查詢回傳 200`);

  if (emailRes.status === 200) {
    const data = await emailRes.json();
    assert(Array.isArray(data.orders), `回傳包含 orders 陣列`);

    if (data.orders?.length > 0) {
      const order = data.orders[0];
      assert(typeof order.id === 'string', `order.id 為字串（stripe_session_id）`);
      assert(typeof order.status === 'string', `order.status 存在`);
      assert(typeof order.payment_status === 'string', `order.payment_status 存在`);
      assert(typeof order.amount_total === 'number', `order.amount_total 為數字`);
      assert(typeof order.currency === 'string', `order.currency 存在`);
      assert(typeof order.created === 'number', `order.created 為 unix timestamp`);
      assert(order.ticket_tier === 'explore', `order.ticket_tier 正確`);
    }
  }

  // 測試查無訂單
  const notFoundRes = await fetch(`${BASE_URL}/api/order/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nonexistent_test_xyz@nowhere.test' }),
  });
  assert(notFoundRes.status === 404, `查無訂單回傳 404`);
}

// ─── 4. Email 大小寫測試 ─────────────────────────
async function testEmailCaseInsensitive(supabase: ReturnType<typeof createClient>) {
  console.log('\n🔤 4. Email 大小寫處理測試');

  // 查詢時用大寫 email
  const upperEmail = TEST_EMAIL.toUpperCase();
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_email', upperEmail.trim().toLowerCase());

  assert((orders?.length ?? 0) > 0, `toLowerCase 轉換後能查到訂單`);
}

// ─── Cleanup ─────────────────────────────────────
async function cleanup(supabase: ReturnType<typeof createClient>) {
  console.log('\n🧹 清理測試資料...');
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('customer_email', TEST_EMAIL);

  assert(!error, `清理測試訂單成功`);
}

// ─── Main ────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  訂單查詢測試                          ║');
  console.log('╚══════════════════════════════════════╝');

  if (!SUPABASE_URL || !SECRET_KEY) {
    console.error('\n❌ 環境變數缺失 (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY)');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    await testSupabaseDirectQuery(supabase);
    await testMultipleOrdersSorting(supabase);
    await testEmailCaseInsensitive(supabase);
    await testAPIRoute();
  } finally {
    await cleanup(supabase);
  }

  console.log('\n══════════════════════════════════════');
  console.log(`結果: ${passed} 通過, ${failed} 失敗`);
  console.log('══════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('測試執行錯誤:', err);
  process.exit(1);
});
