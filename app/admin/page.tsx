// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Stats {
  uniqueEmails: number;
  tiers: {
    explore: { paid: number; comp: number; total: number };
    contribute: { paid: number; comp: number; total: number };
    backer: { paid: number; comp: number; total: number };
  };
  revenue: {
    total: number;
    currency: string;
    last7: number;
    prev7: number;
    paidCount: number;
    avgOrder: number;
  };
  trend: Array<{ date: string; orders: number; subs: number }>;
  prefs: {
    active: number;
    unsubscribed: number;
    newsletter: number;
    events: number;
    award: number;
  };
  attention: {
    pendingStale: number;
    failed: number;
    expired: number;
    refunded: number;
    recentUnsubs: number;
    recentEmailFailures: number;
  };
  matrix: Record<string, Record<string, number>>;
  recentActivity: Array<
    | { kind: 'order'; at: string; email: string | null; name: string | null; tier: string; amount: number; isComp: boolean; upgrade: boolean }
    | { kind: 'sub'; at: string; email: string }
    | { kind: 'unsub'; at: string; email: string }
  >;
  subscribers: { total: number; active: number };
  orders: { total: number; paid: number };
}

const TIER_LABELS: Record<string, string> = {
  explore: 'Explore',
  contribute: 'Contribute',
  weekly_backer: 'Weekly Backer',
  backer: 'Backer',
};

const STATUS_LABELS: Record<string, string> = {
  paid: '已付款',
  pending: '待處理',
  failed: '失敗',
  cancelled: '已取消',
  expired: '已過期',
  refunded: '已退款',
};

const MATRIX_STATUSES = ['paid', 'pending', 'failed', 'expired', 'cancelled', 'refunded'] as const;
const MATRIX_TIERS = ['explore', 'contribute', 'weekly_backer', 'backer'] as const;

function formatCurrency(amount: number, currency: string) {
  return `${(amount / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '剛剛';
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(iso).toLocaleDateString();
}

function StatCard({
  label,
  value,
  sub,
  color,
  ring,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  ring: string;
}) {
  return (
    <div className={`bg-white rounded-xl p-6 shadow-sm border-l-4 ${ring}`}>
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error('[Admin]', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">總覽</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-slate-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const revenueDelta =
    stats.revenue.prev7 > 0
      ? Math.round(((stats.revenue.last7 - stats.revenue.prev7) / stats.revenue.prev7) * 100)
      : null;

  const maxTrend = Math.max(1, ...stats.trend.map((d) => Math.max(d.orders, d.subs)));
  const maxSubs = Math.max(1, stats.prefs.active);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">總覽</h1>

      {/* Top row: required 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="訂閱會員數"
          value={stats.uniqueEmails.toLocaleString()}
          sub="系統中所有 email（含訂閱與訂單）"
          color="#8B5CF6"
          ring="border-[#8B5CF6]"
        />
        <StatCard
          label="Explorer 數"
          value={stats.tiers.explore.total}
          sub={`${stats.tiers.explore.paid} 張付款 / ${stats.tiers.explore.comp} 張招待`}
          color="#10B8D9"
          ring="border-[#10B8D9]"
        />
        <StatCard
          label="Contributor 數"
          value={stats.tiers.contribute.total}
          sub={`${stats.tiers.contribute.paid} 張付款 / ${stats.tiers.contribute.comp} 張招待`}
          color="#22C55E"
          ring="border-[#22C55E]"
        />
        <StatCard
          label="Backer 數"
          value={stats.tiers.backer.total}
          sub={`${stats.tiers.backer.paid} 張付款 / ${stats.tiers.backer.comp} 張招待（含 Weekly Backer）`}
          color="#EAB308"
          ring="border-[#EAB308]"
        />
      </div>

      {/* Revenue + Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">營收健康</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">總收入</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(stats.revenue.total, stats.revenue.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">平均客單價</p>
              <p className="text-xl font-bold text-slate-900">
                {stats.revenue.paidCount > 0
                  ? formatCurrency(stats.revenue.avgOrder, stats.revenue.currency)
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">近 7 日收入</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(stats.revenue.last7, stats.revenue.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">vs 前 7 日</p>
              <p
                className={`text-xl font-bold ${
                  revenueDelta == null
                    ? 'text-slate-400'
                    : revenueDelta >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {revenueDelta == null ? '—' : `${revenueDelta >= 0 ? '↑' : '↓'} ${Math.abs(revenueDelta)}%`}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">需要注意</h2>
          <ul className="space-y-2 text-sm">
            <AttentionRow label="待處理 > 1 小時" value={stats.attention.pendingStale} tone="amber" />
            <AttentionRow label="失敗訂單" value={stats.attention.failed} tone="red" />
            <AttentionRow label="已過期訂單" value={stats.attention.expired} tone="orange" />
            <AttentionRow label="已退款訂單" value={stats.attention.refunded} tone="purple" />
            <AttentionRow label="近 7 日退訂" value={stats.attention.recentUnsubs} tone="slate" />
            <AttentionRow
              label="近 14 日 email 發送失敗"
              value={stats.attention.recentEmailFailures}
              tone="red"
            />
          </ul>
        </div>
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-semibold text-slate-900">近 14 日活動趨勢</h2>
          <div className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#10B8D9]" /> 新訂單
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#8B5CF6]" /> 新訂閱
            </span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-40">
          {stats.trend.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="relative w-full flex items-end gap-0.5 h-36">
                <div
                  className="flex-1 bg-[#10B8D9] rounded-t"
                  style={{ height: `${(d.orders / maxTrend) * 100}%`, minHeight: d.orders > 0 ? 2 : 0 }}
                  title={`${d.date}: ${d.orders} 訂單`}
                />
                <div
                  className="flex-1 bg-[#8B5CF6] rounded-t"
                  style={{ height: `${(d.subs / maxTrend) * 100}%`, minHeight: d.subs > 0 ? 2 : 0 }}
                  title={`${d.date}: ${d.subs} 訂閱`}
                />
              </div>
              <span className="text-[10px] text-slate-400">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Prefs + Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-1">訂閱偏好分布</h2>
          <p className="text-xs text-slate-400 mb-4">
            有效訂閱 {stats.prefs.active.toLocaleString()} 人 · 已退訂 {stats.prefs.unsubscribed.toLocaleString()} 人
          </p>
          <div className="space-y-3">
            <PrefRow label="Festival Newsletter" value={stats.prefs.newsletter} max={maxSubs} color="#8B5CF6" />
            <PrefRow label="Event & Schedule" value={stats.prefs.events} max={maxSubs} color="#10B8D9" />
            <PrefRow label="Nomad Award" value={stats.prefs.award} max={maxSubs} color="#22C55E" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm overflow-x-auto">
          <h2 className="font-semibold text-slate-900 mb-4">身份 × 訂單狀態</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-2 font-normal">身份</th>
                {MATRIX_STATUSES.map((s) => (
                  <th key={s} className="pb-2 pl-2 font-normal text-right">
                    {STATUS_LABELS[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_TIERS.map((t) => (
                <tr key={t} className="border-t border-slate-100">
                  <td className="py-2 font-medium text-slate-700">{TIER_LABELS[t]}</td>
                  {MATRIX_STATUSES.map((s) => {
                    const n = stats.matrix[t]?.[s] ?? 0;
                    return (
                      <td
                        key={s}
                        className={`py-2 pl-2 text-right tabular-nums ${
                          n === 0 ? 'text-slate-300' : 'text-slate-800'
                        }`}
                      >
                        {n}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">最新動態</h2>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400">尚無資料</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {stats.recentActivity.map((a, i) => (
              <li key={i} className="py-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <ActivityBadge kind={a.kind} />
                  <div className="truncate">
                    {a.kind === 'order' && (
                      <>
                        <span className="font-medium text-slate-800">{a.name || a.email || '匿名'}</span>{' '}
                        <span className="text-slate-500">
                          購買 {TIER_LABELS[a.tier] || a.tier}
                          {a.upgrade && ' (升級)'}
                          {a.isComp ? ' · 招待' : ` · ${formatCurrency(a.amount, stats.revenue.currency)}`}
                        </span>
                      </>
                    )}
                    {a.kind === 'sub' && (
                      <>
                        <span className="font-medium text-slate-800">{a.email}</span>{' '}
                        <span className="text-slate-500">訂閱電子報</span>
                      </>
                    )}
                    {a.kind === 'unsub' && (
                      <>
                        <span className="font-medium text-slate-800">{a.email}</span>{' '}
                        <span className="text-slate-500">取消訂閱</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0 ml-3">{formatRelative(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/members" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
          <h3 className="font-semibold text-slate-900 group-hover:text-[#10B8D9] transition-colors">會員管理 →</h3>
          <p className="text-sm text-slate-500 mt-1">以人為單位查看會員資訊</p>
        </Link>
        <Link href="/admin/orders" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
          <h3 className="font-semibold text-slate-900 group-hover:text-[#10B8D9] transition-colors">訂單管理 →</h3>
          <p className="text-sm text-slate-500 mt-1">查看所有交易訂單明細</p>
        </Link>
        <Link href="/admin/send" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
          <h3 className="font-semibold text-slate-900 group-hover:text-[#10B8D9] transition-colors">發送通知 →</h3>
          <p className="text-sm text-slate-500 mt-1">批次發送通知信給會員</p>
        </Link>
      </div>
    </div>
  );
}

function AttentionRow({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'red' | 'orange' | 'purple' | 'slate' }) {
  const toneClass =
    value === 0
      ? 'text-slate-400'
      : {
          amber: 'text-amber-600',
          red: 'text-red-600',
          orange: 'text-orange-600',
          purple: 'text-purple-600',
          slate: 'text-slate-600',
        }[tone];
  return (
    <li className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold tabular-nums ${toneClass}`}>{value}</span>
    </li>
  );
}

function PrefRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-900 font-semibold">
          {value.toLocaleString()} <span className="text-slate-400 font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function ActivityBadge({ kind }: { kind: 'order' | 'sub' | 'unsub' }) {
  const map = {
    order: { label: '訂單', cls: 'bg-green-100 text-green-700' },
    sub: { label: '訂閱', cls: 'bg-purple-100 text-purple-700' },
    unsub: { label: '退訂', cls: 'bg-slate-100 text-slate-600' },
  };
  const m = map[kind];
  return (
    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${m.cls}`}>{m.label}</span>
  );
}
