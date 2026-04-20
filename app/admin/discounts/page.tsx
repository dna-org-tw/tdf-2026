'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface TierBreakdown {
  explore: number;
  contribute: number;
  weekly_backer: number;
  backer: number;
}

interface DiscountRow {
  code: string;
  uses: number;
  paid_uses: number;
  total_discount: number;
  net_revenue: number;
  gross_revenue: number;
  refunded: number;
  avg_discount: number;
  discount_rate: number;
  first_used_at: string | null;
  last_used_at: string | null;
  currency: string;
  tier_breakdown: TierBreakdown;
}

interface Totals {
  codes: number;
  uses: number;
  paid_uses: number;
  total_discount: number;
  net_revenue: number;
}

const RANGE_OPTIONS = [
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
  { value: 90, label: '90 天' },
  { value: 0, label: '全部' },
];

function formatAmount(cents: number, currency = 'usd') {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function formatDate(s: string | null) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Taipei',
  });
}

function tierSummary(b: TierBreakdown) {
  const parts: string[] = [];
  if (b.explore) parts.push(`Explore ${b.explore}`);
  if (b.contribute) parts.push(`Contribute ${b.contribute}`);
  if (b.weekly_backer) parts.push(`Weekly ${b.weekly_backer}`);
  if (b.backer) parts.push(`Backer ${b.backer}`);
  return parts.length > 0 ? parts.join(' · ') : '-';
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [search, setSearch] = useState('');

  const loadDiscounts = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (rangeDays > 0) {
      const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
      params.set('from', from.toISOString());
    }

    try {
      const res = await fetch(`/api/admin/discounts?${params}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDiscounts(data.discounts || []);
      setTotals(data.totals || null);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[Admin Discounts]', err);
        setError('載入失敗');
      }
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    const ctrl = new AbortController();
    loadDiscounts(ctrl.signal);
    return () => ctrl.abort();
  }, [loadDiscounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return discounts;
    return discounts.filter((d) => d.code.toLowerCase().includes(q));
  }, [discounts, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">折扣碼分析</h1>
      </div>

      {/* Range picker */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRangeDays(opt.value)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                rangeDays === opt.value
                  ? 'bg-[#10B8D9] text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋折扣碼..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900 text-sm"
        />
        <span className="text-sm text-slate-500">
          共 {filtered.length} 個折扣碼
        </span>
      </div>

      {/* Summary cards */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">折扣碼數</div>
            <div className="text-xl font-bold text-slate-900">{totals.codes}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">成功使用次數</div>
            <div className="text-xl font-bold text-slate-900">{totals.paid_uses}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">共 {totals.uses} 次嘗試</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">總折讓金額</div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {formatAmount(totals.total_discount)}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">帶進淨收入</div>
            <div className="text-xl font-bold text-green-700 font-mono">
              {formatAmount(totals.net_revenue)}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">折扣碼</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">成功使用</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">總折讓</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">平均折讓</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">折扣比例</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">淨收入</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">票種分布</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">最近使用</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    此時段沒有折扣碼被使用
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.code} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-slate-900">{d.code}</span>
                      {d.uses > d.paid_uses && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {d.uses - d.paid_uses} 筆未付款
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-medium">
                      {d.paid_uses}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-mono">
                      {formatAmount(d.total_discount, d.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 font-mono text-xs">
                      {formatAmount(d.avg_discount, d.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 text-xs">
                      {(d.discount_rate * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-green-700 font-mono">
                      {formatAmount(d.net_revenue, d.currency)}
                      {d.refunded > 0 && (
                        <div className="text-[11px] text-purple-500 mt-0.5">
                          -{formatAmount(d.refunded, d.currency)} 已退款
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {tierSummary(d.tier_breakdown)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
                      {formatDate(d.last_used_at)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <a
                        href={`/admin/orders?discount_code=${encodeURIComponent(d.code)}`}
                        className="text-[#10B8D9] hover:underline text-xs font-medium"
                      >
                        查看訂單
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-4">
        註：折扣碼從 2026/04 起開始逐筆記錄；更早的訂單雖有折讓金額但沒有對應碼名。成功使用次數僅計入已付款 / 已退款 / 部分退款的訂單。
      </p>
    </div>
  );
}
