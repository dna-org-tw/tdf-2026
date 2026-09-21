// Fix orders:
//  A. Remap 14 ch_* (+ 1 corrected) → payment_intent_id, null out wrong session_id.
//  B. Delete 10 cs_test_* dev/test orders.
// Usage: node --env-file=.env.production.local scripts/fix-orders.mjs [--apply]
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const chOrders = [
  // order_id, stored_ch_id, override_ch_id (for the typo'd one)
  ['a6e18bce-9377-41c9-91a0-a8fcabcf52dd', 'ch_3SrBpjB0e5oBVi8T0T3TH1mf'],
  ['05a8b3c9-c2ad-4278-b014-1a0ebeef23ce', 'ch_3Sr9GHB0e5oBVi8T1fU8kpiy'],
  ['b07577f7-be6e-4c48-b499-a607d5f58bf9', 'ch_3Sqxq7B0e5oBVi8T1PjOFcHT'],
  ['3bdc1e99-5b72-4ef4-a3af-abfff10cf2db', 'ch_3Sqqw7B0e5oBVi8T0oU7tDQw'],
  ['75057bd1-52ba-46c7-9edb-b7c45eb0313e', 'ch_3SqquZB0e5oBVi8T1cJr8DCe'],
  ['39e9f93a-be5e-4438-a7f7-43a9b9fcfeb1', 'ch_3SqquRB0e5oBVi8T1Z3eJH5p'],
  ['2e16b35e-880b-4e0a-b120-cb8386e5304b', 'ch_3SqqqoB0e5oBVi8T15rj1MDE'],
  ['04b2b809-6563-4ef4-ac94-28a5d992a681', 'ch_3SqqiKB0e5oBVi8T1pLb0Ngb'],
  ['9103d467-3a72-417e-922a-fe741df7ea13', 'ch_3SqVmnB0e5oBVi8T1wpAkL2P'],
  ['6db18962-8ffe-4927-a352-86d7b0bd7e15', 'ch_3SqU7pB0e5oBVi8T15Q8h5qR'],
  ['9b45bc33-2e02-48fb-bd1d-412438e172dd', 'ch_3SqU5OB0e5oBVi8T0ryVEieu'],
  ['1a1ccbc8-2616-4f61-8836-4bb8a107f729', 'ch_3SqU19B0e5oBVi8T057dk1C5'],
  // bethanyruhl — DB stored ch_…T0mNEkXZG but real charge is …T1mNEkXZG
  ['21da9ffe-48f0-48d6-b7d7-c481c081c898', 'ch_3SqSwdB0e5oBVi8T1mNEkXZG'],
  ['f6d354cb-23da-4ec3-af6b-913cd27a8ed9', 'ch_3SqRe6B0e5oBVi8T07eYHmlC'],
  ['97da411d-d675-4f87-96c3-599463a75abb', 'ch_3SqRITB0e5oBVi8T1GVdQALs'],
];

const testSessionOrders = [
  'ac0abb55-6697-43ed-856e-eb43bb42d181',
  'eca5e075-4490-484c-be04-a74ccb8e1d67',
  'f73cb268-cd65-4a05-a2cd-2c6f1c660dc2',
  'ef22397e-a824-4593-9f04-756bcb6f5c27',
  'ed544405-ec02-45a6-894e-32e3d81be123',
  '6c25c2e7-8804-4539-bd12-830c8041f102',
  '8b1906f9-3c25-4c6f-851c-0c3bb73e57ff',
  '81512c99-bf7a-40d7-9638-780e5273fa33',
  'a22f0eec-fd07-4d13-92c4-f72361e134f4',
  '1e576bc4-73d5-4398-9aaa-edfcf0bcdf0b',
];

console.log(`Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY-RUN'}\n`);

// A. Remap ch_* → pi_*
console.log('== A. Remap ch_* to payment_intent_id');
let aOk = 0, aFail = 0;
for (const [orderId, chargeId] of chOrders) {
  try {
    const ch = await stripe.charges.retrieve(chargeId);
    if (!ch.payment_intent) {
      console.log(`  [skip] ${orderId}  ${chargeId}  charge has no payment_intent`);
      aFail++;
      continue;
    }
    console.log(`  ${orderId}  ch=${chargeId} → pi=${ch.payment_intent}`);
    if (APPLY) {
      const { error } = await sb.from('orders').update({
        stripe_session_id: null,
        stripe_payment_intent_id: ch.payment_intent,
      }).eq('id', orderId);
      if (error) { console.log('    ERROR:', error.message); aFail++; continue; }
    }
    aOk++;
  } catch (e) {
    console.log(`  [fail] ${orderId}  ${chargeId}  ${e.message}`);
    aFail++;
  }
}
console.log(`  done: ${aOk} ok, ${aFail} failed`);

// B. Delete test orders
console.log('\n== B. Delete cs_test_* orders');
if (APPLY) {
  const { data, error } = await sb.from('orders').delete().in('id', testSessionOrders).select('id');
  if (error) console.log('  ERROR:', error.message);
  else console.log(`  deleted ${data.length} rows`);
} else {
  const { data } = await sb.from('orders').select('id, customer_email, ticket_tier, status, stripe_session_id').in('id', testSessionOrders);
  data?.forEach(r => console.log(`  would delete: ${r.id}  ${r.customer_email ?? '(no email)'}  ${r.ticket_tier}  ${r.status}  ${r.stripe_session_id}`));
}

console.log(APPLY ? '\nDone.' : '\nDry run complete. Re-run with --apply to write changes.');
