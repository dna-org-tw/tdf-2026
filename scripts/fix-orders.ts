/**
 * 修正訂單資料：
 * 1. 更新 status CHECK 約束，新增 'expired'
 * 2. 修正 ch_ 開頭的 session ID（Charge ID）→ 用 Stripe Charge API 補齊付款資訊
 * 3. 超過一天的 pending 訂單自動改為 expired
 *
 * Usage: npx tsx scripts/fix-orders.ts
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
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

async function step1_updateConstraint() {
  console.log('=== Step 1: 更新 status CHECK 約束（新增 expired）===\n');

  // 測試插入 expired 狀態
  const testId = `test_expired_${Date.now()}`;
  const { error } = await supabase
    .from('orders')
    .insert({
      stripe_session_id: testId,
      ticket_tier: 'explore',
      status: 'expired',
      amount_subtotal: 0,
      amount_total: 0,
      amount_tax: 0,
      amount_discount: 0,
      currency: 'usd',
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes('check constraint') || error.message.includes('orders_status_check')) {
      console.log('❌ status 約束尚未包含 expired');
      console.log('請在 Supabase Dashboard SQL Editor 執行：\n');
      console.log(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;`);
      console.log(`ALTER TABLE orders ADD CONSTRAINT orders_status_check`);
      console.log(`  CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded'));\n`);
      return false;
    }
    console.log('❌ 插入測試失敗:', error.message);
    return false;
  }

  await supabase.from('orders').delete().eq('stripe_session_id', testId);
  console.log('✅ expired 狀態約束已生效\n');
  return true;
}

async function step2_fixChargeOrders() {
  console.log('=== Step 2: 修正 ch_ 開頭的訂單（Charge ID）===\n');

  const { data: chargeOrders, error } = await supabase
    .from('orders')
    .select('*')
    .like('stripe_session_id', 'ch_%');

  if (error) {
    console.error('查詢失敗:', error.message);
    return;
  }

  if (!chargeOrders || chargeOrders.length === 0) {
    console.log('沒有 ch_ 開頭的訂單\n');
    return;
  }

  console.log(`找到 ${chargeOrders.length} 筆 ch_ 訂單\n`);

  let fixedCount = 0;
  let failedCount = 0;

  for (const order of chargeOrders) {
    const chargeId = order.stripe_session_id;
    try {
      // 透過 Stripe Charge API 取得付款資訊
      const charge = await stripe.charges.retrieve(chargeId, {
        expand: ['payment_intent', 'balance_transaction'],
      });

      const paymentIntent = charge.payment_intent as Stripe.PaymentIntent | null;

      // 取得客戶資訊
      const customerEmail = charge.billing_details?.email || charge.receipt_email || order.customer_email;
      const customerName = charge.billing_details?.name || order.customer_name;
      const customerPhone = charge.billing_details?.phone || order.customer_phone;
      const customerAddress = charge.billing_details?.address
        ? {
            line1: charge.billing_details.address.line1 || null,
            line2: charge.billing_details.address.line2 || null,
            city: charge.billing_details.address.city || null,
            state: charge.billing_details.address.state || null,
            postal_code: charge.billing_details.address.postal_code || null,
            country: charge.billing_details.address.country || null,
          }
        : order.customer_address;

      // 付款方式
      const paymentMethodBrand = charge.payment_method_details?.card?.brand || order.payment_method_brand;
      const paymentMethodLast4 = charge.payment_method_details?.card?.last4 || order.payment_method_last4;
      const paymentMethodType = charge.payment_method_details?.type || order.payment_method_type;

      // 狀態
      let status = order.status;
      if (charge.status === 'succeeded') status = 'paid';
      else if (charge.status === 'failed') status = 'failed';
      else if (charge.refunded) status = 'refunded';

      const updateData: Record<string, unknown> = {
        status,
        customer_email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        payment_method_brand: paymentMethodBrand,
        payment_method_last4: paymentMethodLast4,
        payment_method_type: paymentMethodType,
        updated_at: new Date().toISOString(),
      };

      if (paymentIntent) {
        updateData.stripe_payment_intent_id =
          typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id;
      }

      // 金額（Charge 以最小貨幣單位）
      if (charge.amount) {
        updateData.amount_total = charge.amount;
        updateData.amount_subtotal = charge.amount;
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('stripe_session_id', chargeId);

      if (updateError) {
        console.log(`  ❌ ${chargeId}: ${updateError.message}`);
        failedCount++;
      } else {
        console.log(`  ✅ ${chargeId} → ${status} | ${customerEmail || '(no email)'} | ${paymentMethodBrand || ''} *${paymentMethodLast4 || ''}`);
        fixedCount++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ ${chargeId}: Stripe API 錯誤 - ${msg}`);
      failedCount++;
    }
  }

  console.log(`\n修正: ${fixedCount} | 失敗: ${failedCount}\n`);
}

async function step3_expireStalePending() {
  console.log('=== Step 3: 過期 pending 訂單（超過 1 天）===\n');

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 先查數量
  const { data: staleOrders, error: queryError } = await supabase
    .from('orders')
    .select('id, stripe_session_id, created_at, ticket_tier')
    .eq('status', 'pending')
    .lt('created_at', oneDayAgo);

  if (queryError) {
    console.error('查詢失敗:', queryError.message);
    return;
  }

  if (!staleOrders || staleOrders.length === 0) {
    console.log('沒有需要過期的 pending 訂單\n');
    return;
  }

  console.log(`找到 ${staleOrders.length} 筆超過 1 天的 pending 訂單`);

  // 批次更新
  const { error: updateError, count } = await supabase
    .from('orders')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('created_at', oneDayAgo);

  if (updateError) {
    console.log(`❌ 更新失敗: ${updateError.message}`);
    return;
  }

  console.log(`✅ 已將 ${staleOrders.length} 筆 pending 訂單更新為 expired\n`);

  // 顯示摘要
  const tierCounts: Record<string, number> = {};
  for (const o of staleOrders) {
    tierCounts[o.ticket_tier] = (tierCounts[o.ticket_tier] || 0) + 1;
  }
  for (const [tier, cnt] of Object.entries(tierCounts)) {
    console.log(`  ${tier}: ${cnt}`);
  }
  console.log('');
}

async function printSummary() {
  console.log('=== 最終訂單統計 ===\n');

  const { data: orders } = await supabase.from('orders').select('status, ticket_tier');
  if (!orders) return;

  const statusCounts: Record<string, number> = {};
  const tierCounts: Record<string, number> = {};
  for (const o of orders) {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    tierCounts[o.ticket_tier] = (tierCounts[o.ticket_tier] || 0) + 1;
  }

  console.log('依狀態:');
  for (const [status, cnt] of Object.entries(statusCounts).sort()) {
    console.log(`  ${status}: ${cnt}`);
  }

  console.log('\n依票種:');
  for (const [tier, cnt] of Object.entries(tierCounts).sort()) {
    console.log(`  ${tier}: ${cnt}`);
  }

  console.log(`\n總計: ${orders.length}`);
}

async function main() {
  const constraintOk = await step1_updateConstraint();
  if (!constraintOk) {
    console.log('⚠️  請先更新 status 約束後再重新執行此腳本\n');
    return;
  }
  await step2_fixChargeOrders();
  await step3_expireStalePending();
  await printSummary();
}

main().catch((err) => {
  console.error('執行失敗:', err);
  process.exit(1);
});
