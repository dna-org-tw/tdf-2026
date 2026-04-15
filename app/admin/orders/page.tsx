'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface Order {
  id: string;
  stripe_session_id: string;
  customer_email: string | null;
  customer_name: string | null;
  ticket_tier: string;
  status: string;
  amount_total: number;
  amount_discount: number;
  currency: string;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  created_at: string;
}

interface DailyData {
  date: string;
  orders: number;
  paid: number;
  revenue: number;
}

const TIER_OPTIONS = [
  { value: '', label: '全部票種' },
  { value: 'explore', label: 'Explore' },
  { value: 'contribute', label: 'Contribute' },
  { value: 'weekly_backer', label: 'Weekly Backer' },
  { value: 'backer', label: 'Backer' },
];

const STATUS_OPTIONS = [
  { value: '', label: '全部狀態' },
  { value: 'paid', label: '已付款' },
  { value: 'pending', label: '待處理' },
  { value: 'failed', label: '失敗' },
  { value: 'cancelled', label: '已取消' },
  { value: 'expired', label: '已過期' },
  { value: 'refunded', label: '已退款' },
];

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
  expired: 'bg-orange-100 text-orange-700',
  refunded: 'bg-purple-100 text-purple-700',
};

const STATUS_LABELS: Record<string, string> = {
  paid: '已付款',
  pending: '待處理',
  failed: '失敗',
  cancelled: '已取消',
  expired: '已過期',
  refunded: '已退款',
};

const TIER_LABELS: Record<string, string> = {
  explore: 'Explore',
  contribute: 'Contribute',
  weekly_backer: 'Weekly Backer',
  backer: 'Backer',
};

const RANGE_OPTIONS = [
  { value: 7, label: '7 天' },
  { value: 14, label: '14 天' },
  { value: 30, label: '30 天' },
  { value: 90, label: '90 天' },
];

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00+08:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-slate-900 mb-1">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string; dataKey: string }) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.dataKey === 'cumulativeRevenue'
            ? `${entry.name}: $${(entry.value / 100).toFixed(2)}`
            : `${entry.name}: ${entry.value}`}
        </p>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [status, setStatus] = useState('');
  const [hasCustomer, setHasCustomer] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartRange, setChartRange] = useState(30);

  // Fetch daily chart data
  useEffect(() => {
    setChartLoading(true);
    fetch(`/api/admin/orders/daily?days=${chartRange}`)
      .then((res) => res.json())
      .then((data) => {
        // Compute cumulative revenue starting from prior total
        const daily = data.daily || [];
        let cumulative = data.priorRevenue || 0;
        const withCumulative = daily.map((d: DailyData) => {
          cumulative += d.revenue;
          return { ...d, cumulativeRevenue: cumulative };
        });
        setDailyData(withCumulative);
      })
      .catch((err) => console.error('[Admin Chart]', err))
      .finally(() => setChartLoading(false));
  }, [chartRange]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (tier) params.set('tier', tier);
      if (status) params.set('status', status);
      if (hasCustomer) params.set('hasCustomer', '1');
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (err) {
      console.error('[Admin Orders]', err);
    } finally {
      setLoading(false);
    }
  }, [search, tier, status, hasCustomer, page]);

  useEffect(() => {
    const timer = setTimeout(fetchOrders, 300);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  useEffect(() => {
    setPage(1);
  }, [search, tier, status, hasCustomer]);

  const formatAmount = (amount: number, currency: string) => {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Taipei',
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">訂單管理</h1>

      {/* Daily Sales Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">每日銷售趨勢</h2>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setChartRange(opt.value)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  chartRange === opt.value
                    ? 'bg-[#10B8D9] text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {chartLoading ? (
          <div className="h-[240px] bg-slate-50 rounded-lg animate-pulse" />
        ) : dailyData.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">
            尚無資料
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                tickFormatter={(v: number) => `$${(v / 100).toFixed(0)}`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                yAxisId="left"
                dataKey="paid"
                name="已付款訂單"
                fill="#10B8D9"
                radius={[2, 2, 0, 0]}
                barSize={chartRange <= 14 ? 16 : chartRange <= 30 ? 8 : 4}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativeRevenue"
                name="累計收入"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        <div className="flex items-center gap-6 mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 bg-[#10B8D9] rounded-sm" />
            已付款訂單
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-green-500 rounded" />
            累計收入
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 Email 或姓名..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900 text-sm"
        />
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#10B8D9]"
        >
          {TIER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#10B8D9]"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasCustomer}
            onChange={(e) => setHasCustomer(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#10B8D9] focus:ring-[#10B8D9]"
          />
          只顯示有顧客資訊
        </label>
        <span className="text-sm text-slate-500">共 {total} 筆訂單</span>
        <a
          href={`/api/admin/orders/export?${new URLSearchParams({
            ...(search ? { search } : {}),
            ...(tier ? { tier } : {}),
            ...(status ? { status } : {}),
            ...(hasCustomer ? { hasCustomer: '1' } : {}),
          }).toString()}`}
          className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] rounded-lg hover:bg-[#0EA5C4] transition-colors whitespace-nowrap"
          title="以目前篩選條件匯出 CSV"
        >
          匯出 CSV
        </a>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">訂單編號</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">顧客</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">票種</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">狀態</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">付款方式</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">金額</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">建立時間</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    沒有符合條件的訂單
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                      {o.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900 font-medium">{o.customer_name || '-'}</div>
                      <div className="text-slate-500 text-xs">{o.customer_email || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-slate-700 text-xs">
                        {TIER_LABELS[o.ticket_tier] || o.ticket_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[o.status] || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {o.payment_method_brand && o.payment_method_last4
                        ? `${o.payment_method_brand} •••• ${o.payment_method_last4}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-mono">
                      {formatAmount(o.amount_total, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
                      {formatDate(o.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一頁
          </button>
          <span className="text-sm text-slate-500">
            第 {page} / {totalPages} 頁
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}
