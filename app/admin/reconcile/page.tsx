'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type {
  Discrepancy,
  ReconcileNumericResult,
  ReconcileResult,
  ReconcileTerminalResult,
} from '@/lib/stripeReconcileTypes';
import { isTerminalResult } from '@/lib/stripeReconcileTypes';

function formatCurrency(amount: number, currency: string) {
  return `${(amount / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${currency.toUpperCase()}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

const TYPE_LABELS: Record<Discrepancy['type'], string> = {
  missing_in_db: 'DB 未記錄',
  amount_mismatch: '金額不符',
  missing_in_stripe: 'Stripe 查無',
};

const TYPE_ORDER: Record<Discrepancy['type'], number> = {
  missing_in_db: 0,
  amount_mismatch: 1,
  missing_in_stripe: 2,
};

const TYPE_STYLES: Record<Discrepancy['type'], string> = {
  missing_in_db: 'border-l-4 border-red-500 bg-red-50/50',
  amount_mismatch: 'border-l-4 border-amber-500 bg-amber-50/50',
  missing_in_stripe: 'border-l-4 border-slate-400 bg-slate-50/50',
};

export default function ReconcilePage() {
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/admin/stripe-reconcile${force ? '?force=1' : ''}`);
      const data = (await res.json()) as ReconcileResult;
      setResult(data);
    } catch (err) {
      console.error('[Reconcile]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Stripe 對帳</h1>
        <div className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
          <div className="h-6 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Stripe 對帳</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          無法取得對帳資料
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-slate-500 hover:text-[#10B8D9]">
            ← 返回總覽
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Stripe 對帳</h1>
          {result.is_test_mode && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
              TEST 模式
            </span>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-sm px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {refreshing ? '重算中…' : '強制重算'}
        </button>
      </div>

      {isTerminalResult(result) ? (
        <TerminalCard result={result} />
      ) : (
        <>
          <SummaryCard result={result} />
          <DiscrepancyList result={result} />
        </>
      )}
    </div>
  );
}

function TerminalCard({ result }: { result: ReconcileTerminalResult }) {
  const msg =
    result.status === 'multi_currency'
      ? '偵測到多種幣別的訂單，目前不支援跨幣別對帳。'
      : result.status === 'stripe_unavailable'
        ? 'Stripe API 暫時無法回應，稍後再試。'
        : result.status === 'not_configured'
          ? 'Stripe 未設定（STRIPE_SECRET_KEY 不存在）。'
          : 'DB 無法連線。';
  const tone =
    result.status === 'stripe_unavailable'
      ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-slate-50 border-slate-200 text-slate-700';
  return (
    <div className={`rounded-xl border p-6 ${tone}`}>
      <p className="font-medium">{msg}</p>
      {result.error_message && (
        <p className="text-xs mt-2 font-mono break-all opacity-75">{result.error_message}</p>
      )}
      <p className="text-xs mt-3 opacity-60">對帳時間：{formatDateTime(result.checked_at)}</p>
    </div>
  );
}

function SummaryCard({ result }: { result: ReconcileNumericResult }) {
  const diffTone =
    result.diff === 0
      ? 'text-green-700'
      : result.diff < 0
        ? 'text-red-700'
        : 'text-amber-700';
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">DB 端淨收入</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">
            {formatCurrency(result.db_total, result.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Stripe 端淨收入</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">
            {formatCurrency(result.stripe_total, result.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">差額 (DB − Stripe)</p>
          <p className={`text-xl font-bold tabular-nums ${diffTone}`}>
            {result.diff === 0 ? '0' : `${result.diff > 0 ? '+' : ''}${formatCurrency(result.diff, result.currency)}`}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">對帳時間</p>
          <p className="text-sm font-medium text-slate-700">{formatDateTime(result.checked_at)}</p>
          {result.cached && <p className="text-xs text-slate-400 mt-0.5">（快取結果）</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">
          DB 未記錄 {result.counts.missing_in_db}
        </span>
        <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
          金額不符 {result.counts.amount_mismatch}
        </span>
        <span className="px-2 py-1 rounded bg-slate-50 text-slate-700 border border-slate-200">
          Stripe 查無 {result.counts.missing_in_stripe}
        </span>
      </div>
    </div>
  );
}

function DiscrepancyList({ result }: { result: ReconcileNumericResult }) {
  if (result.discrepancies.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 shadow-sm text-center text-slate-500">
        <p className="text-lg">目前 DB 與 Stripe 完全一致 ✓</p>
      </div>
    );
  }

  const sorted = [...result.discrepancies].sort(
    (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  );
  const dashboardBase = result.is_test_mode
    ? 'https://dashboard.stripe.com/test/payments'
    : 'https://dashboard.stripe.com/payments';

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
            <th className="px-4 py-3 font-normal">類型</th>
            <th className="px-4 py-3 font-normal">PaymentIntent</th>
            <th className="px-4 py-3 font-normal">Tier</th>
            <th className="px-4 py-3 font-normal text-right">DB 淨額</th>
            <th className="px-4 py-3 font-normal text-right">Stripe 淨額</th>
            <th className="px-4 py-3 font-normal">Stripe 建立時間</th>
            <th className="px-4 py-3 font-normal">操作</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr key={`${d.type}-${d.payment_intent_id}`} className={`${TYPE_STYLES[d.type]}`}>
              <td className="px-4 py-3 font-medium">{TYPE_LABELS[d.type]}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-700 break-all">
                {d.payment_intent_id}
              </td>
              <td className="px-4 py-3 text-slate-700">{d.ticket_tier || '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {d.db_net == null ? '—' : formatCurrency(d.db_net, result.currency)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {d.stripe_net == null ? '—' : formatCurrency(d.stripe_net, result.currency)}
              </td>
              <td className="px-4 py-3 text-slate-600 text-xs">
                {formatDateTime(d.stripe_created)}
              </td>
              <td className="px-4 py-3 space-x-2 text-xs">
                <a
                  href={`${dashboardBase}/${d.payment_intent_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#10B8D9] hover:underline"
                >
                  Stripe ↗
                </a>
                {d.db_order_id && (
                  <Link
                    href={`/admin/orders/${d.db_order_id}`}
                    className="text-[#10B8D9] hover:underline"
                  >
                    訂單
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
