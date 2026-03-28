/**
 * 1. 透過 Supabase REST API 執行遷移（更新 ticket_tier CHECK 約束）
 * 2. 從 Stripe 拉取所有 checkout sessions，同步付款資訊到 orders 表
 *
 * Usage: npx tsx scripts/sync-orders.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Load .env.local manually
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}
if (!stripeSecretKey) {
  console.error('Missing STRIPE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });

async function runMigration() {
  console.log('\n=== Step 1: 更新資料庫 CHECK 約束 ===');

  // 使用 Supabase rpc 執行 raw SQL
  const { error } = await supabase.rpc('exec_sql', {
    query: `
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_ticket_tier_check;
      ALTER TABLE orders ADD CONSTRAINT orders_ticket_tier_check
        CHECK (ticket_tier IN ('explore', 'contribute', 'weekly_backer', 'backer'));
    `,
  });

  if (error) {
    // rpc exec_sql 可能不存在，改用 REST SQL endpoint
    console.warn('rpc exec_sql 不可用，嘗試直接使用 Supabase SQL REST endpoint...');

    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        query: `
          ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_ticket_tier_check;
          ALTER TABLE orders ADD CONSTRAINT orders_ticket_tier_check
            CHECK (ticket_tier IN ('explore', 'contribute', 'weekly_backer', 'backer'));
        `,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('無法透過 REST 執行 SQL，請手動在 Supabase Dashboard SQL Editor 執行以下 SQL：');
      console.error(`
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_ticket_tier_check;
ALTER TABLE orders ADD CONSTRAINT orders_ticket_tier_check
  CHECK (ticket_tier IN ('explore', 'contribute', 'weekly_backer', 'backer'));
      `);
      console.error('REST 回應:', text);
      console.log('繼續執行 Stripe 同步...\n');
    } else {
      console.log('CHECK 約束更新成功！');
    }
  } else {
    console.log('CHECK 約束更新成功！');
  }
}

async function syncStripeOrders() {
  console.log('\n=== Step 2: 從 Stripe 同步訂單到 Supabase ===');

  // 列出所有 checkout sessions
  let hasMore = true;
  let startingAfter: string | undefined;
  let syncedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  while (hasMore) {
    const params: Stripe.Checkout.SessionListParams = {
      limit: 100,
      expand: ['data.payment_intent', 'data.line_items'],
    };
    if (startingAfter) params.starting_after = startingAfter;

    const sessions = await stripe.checkout.sessions.list(params);

    for (const session of sessions.data) {
      syncedCount++;
      const sessionId = session.id;

      // 從 metadata 或 success_url 判斷 tier
      let tier = session.metadata?.tier;
      if (!tier && session.success_url) {
        const match = session.success_url.match(/tier=(\w+)/);
        if (match) tier = match[1];
      }
      if (!tier) {
        console.log(`  跳過 ${sessionId}: 無法判斷 tier`);
        skippedCount++;
        continue;
      }

      // 將 little_backer 映射為 weekly_backer
      if (tier === 'little_backer') tier = 'weekly_backer';

      // 驗證 tier 合法性
      if (!['explore', 'contribute', 'weekly_backer', 'backer'].includes(tier)) {
        console.log(`  跳過 ${sessionId}: 無效的 tier "${tier}"`);
        skippedCount++;
        continue;
      }

      // 判斷狀態
      let status: string;
      if (session.status === 'complete' && session.payment_status === 'paid') {
        status = 'paid';
      } else if (session.status === 'expired') {
        status = 'cancelled';
      } else {
        status = 'pending';
      }

      // 取得付款資訊
      const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;
      let charge: Stripe.Charge | null = null;
      if (paymentIntent?.latest_charge) {
        try {
          const chargeId =
            typeof paymentIntent.latest_charge === 'string'
              ? paymentIntent.latest_charge
              : paymentIntent.latest_charge.id;
          charge = await stripe.charges.retrieve(chargeId);
        } catch {
          // ignore
        }
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

      const orderData = {
        stripe_session_id: sessionId,
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
      };

      // 嘗試 upsert
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('stripe_session_id', sessionId)
        .single();

      if (existing) {
        // 更新現有訂單
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            ...orderData,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_session_id', sessionId);

        if (updateError) {
          console.error(`  更新失敗 ${sessionId}:`, updateError.message);
        } else {
          updatedCount++;
          console.log(`  更新 ${sessionId} [${tier}] → ${status}`);
        }
      } else {
        // 建立新訂單
        const { error: insertError } = await supabase.from('orders').insert(orderData);

        if (insertError) {
          console.error(`  建立失敗 ${sessionId}:`, insertError.message);
        } else {
          createdCount++;
          console.log(`  建立 ${sessionId} [${tier}] → ${status}`);
        }
      }
    }

    hasMore = sessions.has_more;
    if (sessions.data.length > 0) {
      startingAfter = sessions.data[sessions.data.length - 1].id;
    }
  }

  console.log(`\n=== 同步完成 ===`);
  console.log(`  總共處理: ${syncedCount}`);
  console.log(`  新建訂單: ${createdCount}`);
  console.log(`  更新訂單: ${updatedCount}`);
  console.log(`  跳過: ${skippedCount}`);
}

async function main() {
  await runMigration();
  await syncStripeOrders();
}

main().catch((err) => {
  console.error('執行失敗:', err);
  process.exit(1);
});
