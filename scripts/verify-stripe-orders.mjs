// Verifies Supabase <-> Stripe order consistency (both directions).
// Usage: node --env-file=.env.production.local scripts/verify-stripe-orders.mjs
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// TDF price IDs (from env) — used to identify TDF-related Stripe sessions.
const tdfPrices = new Set(
  [
    process.env.STRIPE_PRICE_BACKER,
    process.env.STRIPE_PRICE_CONTRIBUTE,
    process.env.STRIPE_PRICE_EXPLORE,
    process.env.STRIPE_PRICE_WEEKLY_BACKER,
  ].filter(Boolean)
);

const fmt = (o) => `${o.id}  ${o.customer_email ?? '(no email)'}  ${o.ticket_tier ?? ''}  ${o.status ?? ''}  src=${o.source ?? ''}`;

async function fetchAllOrders() {
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, customer_email, ticket_tier, status, source, stripe_session_id, stripe_payment_intent_id, stripe_invoice_id, amount_total, amount_refunded, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function fetchAllStripeSessions() {
  const out = [];
  let starting_after;
  for (;;) {
    const res = await stripe.checkout.sessions.list({
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
      expand: ['data.line_items'],
    });
    out.push(...res.data);
    if (!res.has_more) break;
    starting_after = res.data[res.data.length - 1].id;
  }
  return out;
}

async function sessionIsTdf(session) {
  const items = session.line_items?.data;
  if (items && items.length) {
    return items.some((li) => tdfPrices.has(li.price?.id));
  }
  // Fallback: fetch line items on demand (sessions older than expand scope).
  try {
    const li = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    return li.data.some((i) => tdfPrices.has(i.price?.id));
  } catch {
    return false;
  }
}

async function main() {
  console.log('TDF price IDs:', [...tdfPrices]);
  console.log('\n== Fetching Supabase orders...');
  const orders = await fetchAllOrders();
  console.log(`Supabase orders: ${orders.length}`);

  console.log('\n== Fetching Stripe checkout sessions...');
  const sessions = await fetchAllStripeSessions();
  console.log(`Stripe sessions: ${sessions.length}`);

  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  // Direction 1: every Supabase order -> valid Stripe record (session OR invoice)
  console.log('\n== [1] Supabase → Stripe');
  const missingInStripe = [];
  const mismatchedEmail = [];
  const unpaidButCompleted = [];
  for (const o of orders) {
    const isComp = Number(o.amount_total) === 0 && (o.status === 'paid' || o.status === 'comped');
    if (!o.stripe_session_id && !o.stripe_invoice_id && !o.stripe_payment_intent_id) {
      if (isComp) continue;
      missingInStripe.push({ order: o, reason: 'no stripe id in DB' });
      continue;
    }

    let stripeEmail = '';
    let stripePaid = false;
    let stripeStatus = '';

    if (o.stripe_session_id) {
      let s = sessionById.get(o.stripe_session_id);
      if (!s) {
        try {
          s = await stripe.checkout.sessions.retrieve(o.stripe_session_id);
        } catch (e) {
          missingInStripe.push({ order: o, reason: `session retrieve failed: ${e.message}` });
          continue;
        }
      }
      stripeEmail = (s.customer_details?.email || s.customer_email || '').toLowerCase();
      stripeStatus = s.payment_status;
      stripePaid = s.payment_status === 'paid' || s.payment_status === 'no_payment_required';
    } else if (o.stripe_payment_intent_id) {
      try {
        const pi = await stripe.paymentIntents.retrieve(o.stripe_payment_intent_id);
        stripeEmail = (pi.receipt_email || pi.charges?.data?.[0]?.billing_details?.email || '').toLowerCase();
        stripeStatus = pi.status;
        stripePaid = pi.status === 'succeeded';
      } catch (e) {
        missingInStripe.push({ order: o, reason: `payment_intent retrieve failed: ${e.message}` });
        continue;
      }
    } else if (o.stripe_invoice_id) {
      try {
        const inv = await stripe.invoices.retrieve(o.stripe_invoice_id);
        stripeEmail = (inv.customer_email || '').toLowerCase();
        stripeStatus = inv.status;
        stripePaid = inv.status === 'paid';
      } catch (e) {
        missingInStripe.push({ order: o, reason: `invoice retrieve failed: ${e.message}` });
        continue;
      }
    }

    const dbEmail = (o.customer_email || '').toLowerCase();
    if (stripeEmail && dbEmail && stripeEmail !== dbEmail) {
      mismatchedEmail.push({ order: o, stripeEmail });
    }
    if (o.status === 'paid' && !stripePaid) {
      unpaidButCompleted.push({ order: o, stripeStatus });
    }
  }
  console.log(`  missing / unretrievable in Stripe: ${missingInStripe.length}`);
  missingInStripe.forEach(({ order, reason }) => console.log(`    - ${fmt(order)}  [${reason}]`));
  console.log(`  email mismatch: ${mismatchedEmail.length}`);
  mismatchedEmail.forEach(({ order, stripeEmail }) =>
    console.log(`    - ${fmt(order)}  stripe=${stripeEmail}`)
  );
  console.log(`  DB paid but Stripe not paid: ${unpaidButCompleted.length}`);
  unpaidButCompleted.forEach(({ order, stripeStatus }) =>
    console.log(`    - ${fmt(order)}  stripe_status=${stripeStatus}`)
  );

  // Direction 2: every TDF-related Stripe session -> in Supabase
  console.log('\n== [2] Stripe → Supabase (TDF-related only)');
  const dbIds = new Set(orders.map((o) => o.stripe_session_id).filter(Boolean));
  const missingInDb = [];
  let tdfCount = 0;
  for (const s of sessions) {
    const isTdf = await sessionIsTdf(s);
    if (!isTdf) continue;
    tdfCount++;
    if (!dbIds.has(s.id)) {
      missingInDb.push(s);
    }
  }
  console.log(`  TDF-related Stripe sessions: ${tdfCount}`);
  console.log(`  missing in Supabase: ${missingInDb.length}`);
  missingInDb.forEach((s) =>
    console.log(
      `    - ${s.id}  ${s.customer_details?.email ?? s.customer_email ?? '(no email)'}  status=${s.status}  payment=${s.payment_status}  created=${new Date(
        s.created * 1000
      ).toISOString()}`
    )
  );

  const hasIssue =
    missingInStripe.length || mismatchedEmail.length || unpaidButCompleted.length || missingInDb.length;
  console.log(`\n== Result: ${hasIssue ? 'ISSUES FOUND' : 'ALL CONSISTENT ✓'}`);
  process.exit(hasIssue ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
