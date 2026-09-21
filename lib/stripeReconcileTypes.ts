export type DiscrepancyType = 'missing_in_db' | 'missing_in_stripe' | 'amount_mismatch';

export type Discrepancy = {
  type: DiscrepancyType;
  payment_intent_id: string;
  db_order_id: string | null;
  ticket_tier: string | null;
  db_net: number | null;
  stripe_net: number | null;
  stripe_created: string | null;
};

export type ReconcileNumericResult = {
  status: 'ok' | 'warning' | 'critical';
  db_total: number;
  stripe_total: number;
  diff: number;
  currency: string;
  checked_at: string;
  cached: boolean;
  is_test_mode: boolean;
  counts: { missing_in_db: number; missing_in_stripe: number; amount_mismatch: number };
  discrepancies: Discrepancy[];
};

export type ReconcileTerminalResult = {
  status: 'multi_currency' | 'stripe_unavailable' | 'not_configured' | 'db_unavailable';
  checked_at: string;
  cached: boolean;
  is_test_mode: boolean;
  error_message?: string;
};

export type ReconcileResult = ReconcileNumericResult | ReconcileTerminalResult;

export function isTerminalResult(r: ReconcileResult): r is ReconcileTerminalResult {
  return (
    r.status === 'multi_currency' ||
    r.status === 'stripe_unavailable' ||
    r.status === 'not_configured' ||
    r.status === 'db_unavailable'
  );
}
