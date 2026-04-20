import Stripe from 'stripe';
import { supabaseServer } from './supabaseServer';
import type { Discrepancy, ReconcileResult } from './stripeReconcileTypes';

export type {
  Discrepancy,
  DiscrepancyType,
  ReconcileNumericResult,
  ReconcileResult,
  ReconcileTerminalResult,
} from './stripeReconcileTypes';
export { isTerminalResult } from './stripeReconcileTypes';

type DbOrderRow = {
  id: string;
  stripe_payment_intent_id: string | null;
  ticket_tier: string;
  amount_total: number | string | null;
  amount_refunded: number | string | null;
  currency: string | null;
};

type StripePiInfo = {
  received: number;
  refunded: number;
  created: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { payload: ReconcileResult; expires_at: number } | null = null;

export function clearReconcileCache() {
  cache = null;
}

function isTestKey(key: string | undefined): boolean {
  return !!key && key.startsWith('sk_test');
}

export async function runReconcile(options: { force?: boolean } = {}): Promise<ReconcileResult> {
  const now = Date.now();
  if (!options.force && cache && cache.expires_at > now) {
    return { ...cache.payload, cached: true };
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const isTest = isTestKey(stripeSecretKey);
  const checkedAt = new Date(now).toISOString();

  if (!stripeSecretKey) {
    return {
      status: 'not_configured',
      checked_at: checkedAt,
      cached: false,
      is_test_mode: false,
      error_message: 'STRIPE_SECRET_KEY is not set',
    };
  }
  if (!supabaseServer) {
    return {
      status: 'db_unavailable',
      checked_at: checkedAt,
      cached: false,
      is_test_mode: isTest,
      error_message: 'Supabase client not initialized',
    };
  }

  const { data: ordersData, error: ordersErr } = await supabaseServer
    .from('orders')
    .select('id, stripe_payment_intent_id, ticket_tier, amount_total, amount_refunded, currency, status')
    .in('status', ['paid', 'partially_refunded'])
    .limit(50000);

  if (ordersErr) {
    return {
      status: 'db_unavailable',
      checked_at: checkedAt,
      cached: false,
      is_test_mode: isTest,
      error_message: ordersErr.message,
    };
  }

  const dbOrders = (ordersData || []) as DbOrderRow[];
  const currencies = new Set(dbOrders.map((o) => (o.currency || 'usd').toLowerCase()));
  if (currencies.size > 1) {
    return {
      status: 'multi_currency',
      checked_at: checkedAt,
      cached: false,
      is_test_mode: isTest,
    };
  }
  const currency = (dbOrders[0]?.currency || 'usd').toLowerCase();

  const dbByPi = new Map<string, DbOrderRow>();
  const dbOrdersNoPi: DbOrderRow[] = [];
  for (const o of dbOrders) {
    if (o.stripe_payment_intent_id) {
      dbByPi.set(o.stripe_payment_intent_id, o);
    } else {
      dbOrdersNoPi.push(o);
    }
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });

  const stripeByPi = new Map<string, StripePiInfo>();
  try {
    for await (const pi of stripe.paymentIntents.list({ limit: 100, expand: ['data.latest_charge'] })) {
      if (pi.status !== 'succeeded') continue;
      const charge = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null;
      stripeByPi.set(pi.id, {
        received: pi.amount_received ?? 0,
        refunded: charge?.amount_refunded ?? 0,
        created: pi.created,
      });
    }
  } catch (err) {
    console.error('[Reconcile] Stripe list paymentIntents failed:', err);
    return {
      status: 'stripe_unavailable',
      checked_at: checkedAt,
      cached: false,
      is_test_mode: isTest,
      error_message: err instanceof Error ? err.message : 'Unknown Stripe error',
    };
  }

  const discrepancies: Discrepancy[] = [];

  const dbNetOf = (o: DbOrderRow) =>
    Number(o.amount_total || 0) - Number(o.amount_refunded || 0);
  const stripeNetOf = (s: StripePiInfo) => s.received - s.refunded;

  for (const [piId, dbRow] of dbByPi) {
    const s = stripeByPi.get(piId);
    if (!s) {
      discrepancies.push({
        type: 'missing_in_stripe',
        payment_intent_id: piId,
        db_order_id: dbRow.id,
        ticket_tier: dbRow.ticket_tier,
        db_net: dbNetOf(dbRow),
        stripe_net: null,
        stripe_created: null,
      });
      continue;
    }
    const dbNet = dbNetOf(dbRow);
    const stripeNet = stripeNetOf(s);
    if (dbNet !== stripeNet) {
      discrepancies.push({
        type: 'amount_mismatch',
        payment_intent_id: piId,
        db_order_id: dbRow.id,
        ticket_tier: dbRow.ticket_tier,
        db_net: dbNet,
        stripe_net: stripeNet,
        stripe_created: new Date(s.created * 1000).toISOString(),
      });
    }
  }

  for (const [piId, s] of stripeByPi) {
    if (dbByPi.has(piId)) continue;
    discrepancies.push({
      type: 'missing_in_db',
      payment_intent_id: piId,
      db_order_id: null,
      ticket_tier: null,
      db_net: null,
      stripe_net: stripeNetOf(s),
      stripe_created: new Date(s.created * 1000).toISOString(),
    });
  }

  const counts = {
    missing_in_db: discrepancies.filter((d) => d.type === 'missing_in_db').length,
    missing_in_stripe: discrepancies.filter((d) => d.type === 'missing_in_stripe').length,
    amount_mismatch: discrepancies.filter((d) => d.type === 'amount_mismatch').length,
  };

  const dbTotal = dbOrders.reduce((sum, o) => sum + dbNetOf(o), 0);
  let stripeTotal = 0;
  for (const s of stripeByPi.values()) stripeTotal += stripeNetOf(s);

  const status: 'ok' | 'warning' | 'critical' =
    counts.missing_in_db > 0
      ? 'critical'
      : counts.missing_in_stripe > 0 || counts.amount_mismatch > 0
        ? 'warning'
        : 'ok';

  const payload: ReconcileResult = {
    status,
    db_total: dbTotal,
    stripe_total: stripeTotal,
    diff: dbTotal - stripeTotal,
    currency,
    checked_at: checkedAt,
    cached: false,
    is_test_mode: isTest,
    counts,
    discrepancies,
  };

  cache = { payload, expires_at: now + CACHE_TTL_MS };

  // DB orders with no stripe_payment_intent_id: not considered discrepancies here
  // (e.g. pending upgrade invoices before invoice.paid webhook backfills the PI),
  // but logged so we notice if they persist. Caller can inspect via admin UI if needed.
  if (dbOrdersNoPi.length > 0) {
    console.log(
      `[Reconcile] ${dbOrdersNoPi.length} paid/partially_refunded orders have no stripe_payment_intent_id (likely invoice-based upgrades mid-flight)`,
    );
  }

  return payload;
}
