/**
 * Backfill orders.discount_code / discount_promotion_code_id / discount_coupon_id
 * from Stripe for orders whose amount_discount > 0 but discount_code IS NULL.
 *
 * Dry-run (default):
 *   node --env-file=.env.production.local -r tsx/cjs scripts/backfill-discount-codes.ts
 *   # or: npx tsx scripts/backfill-discount-codes.ts
 *
 * Apply:
 *   npx tsx scripts/backfill-discount-codes.ts --apply
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { extractSessionDiscount } from '../lib/stripeDiscount';

const APPLY = process.argv.includes('--apply');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}
if (!stripeKey) {
  console.error('Missing STRIPE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stripe = new Stripe(stripeKey, { apiVersion: '2025-12-15.clover' });

interface OrderRow {
  id: string;
  stripe_session_id: string;
  amount_discount: number | null;
  discount_code: string | null;
  created_at: string;
  ticket_tier: string;
  status: string;
}

async function main() {
  console.log(`\n=== Backfill discount_code from Stripe (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, stripe_session_id, amount_discount, discount_code, created_at, ticket_tier, status')
    .gt('amount_discount', 0)
    .is('discount_code', null)
    .order('created_at', { ascending: false })
    .returns<OrderRow[]>();

  if (error) {
    console.error('Supabase fetch failed:', error);
    process.exit(1);
  }

  const candidates = orders ?? [];
  console.log(`Found ${candidates.length} candidate order(s) with amount_discount > 0 and discount_code IS NULL\n`);

  if (candidates.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  let resolved = 0;
  let emptyLookup = 0;
  let skippedNonSession = 0;
  let failed = 0;
  let updated = 0;

  for (const order of candidates) {
    const sid = order.stripe_session_id;
    const tag = `[${order.id} / ${sid}]`;

    if (!sid || !sid.startsWith('cs_')) {
      skippedNonSession++;
      console.log(`${tag} SKIP (non-checkout-session stripe_session_id)`);
      continue;
    }

    let extracted;
    try {
      extracted = await extractSessionDiscount(sid, stripe);
    } catch (err) {
      failed++;
      console.error(`${tag} EXTRACT FAIL:`, err);
      continue;
    }

    if (!extracted.discount_code && !extracted.discount_promotion_code_id && !extracted.discount_coupon_id) {
      emptyLookup++;
      console.log(`${tag} NO DISCOUNT METADATA on Stripe (amount_discount=${order.amount_discount}; possibly pre-promotion-code era)`);
      continue;
    }

    resolved++;
    console.log(
      `${tag} → code=${extracted.discount_code ?? '-'} promo=${extracted.discount_promotion_code_id ?? '-'} coupon=${extracted.discount_coupon_id ?? '-'} (tier=${order.ticket_tier}, status=${order.status}, discount=${order.amount_discount})`
    );

    if (!APPLY) continue;

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        discount_code: extracted.discount_code,
        discount_promotion_code_id: extracted.discount_promotion_code_id,
        discount_coupon_id: extracted.discount_coupon_id,
      })
      .eq('id', order.id);

    if (updateError) {
      failed++;
      console.error(`${tag} UPDATE FAIL:`, updateError.message);
    } else {
      updated++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Candidates           : ${candidates.length}`);
  console.log(`  Resolved on Stripe   : ${resolved}`);
  console.log(`  Empty on Stripe      : ${emptyLookup}`);
  console.log(`  Skipped (non-cs_)    : ${skippedNonSession}`);
  console.log(`  Updated in DB        : ${updated}`);
  console.log(`  Errors               : ${failed}`);
  if (!APPLY) console.log(`\n(dry-run only — re-run with --apply to write)`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
