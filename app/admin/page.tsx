// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Stats {
  orders: {
    total: number;
    paid: number;
    uniqueMembers: number;
    totalRevenue: number;
    currency: string;
    byTier: Record<string, number>;
    byStatus: Record<string, number>;
  };
  subscribers: {
    total: number;
  };
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

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
  expired: 'bg-orange-100 text-orange-700',
  refunded: 'bg-purple-100 text-purple-700',
};

const STATUS_ORDER = ['paid', 'pending', 'failed', 'cancelled', 'expired', 'refunded'];

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

  const formatCurrency = (amount: number, currency: string) => {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  };

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">總覽</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">會員數</p>
          <p className="text-3xl font-bold text-[#10B8D9]">{stats.orders.uniqueMembers}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">總訂單數</p>
          <p className="text-3xl font-bold text-slate-900">{stats.orders.total}</p>
          <p className="text-xs text-slate-400 mt-1">{stats.orders.paid} 筆已付款</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">總收入</p>
          <p className="text-3xl font-bold text-green-600">
            {formatCurrency(stats.orders.totalRevenue, stats.orders.currency)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">電子報訂閱者</p>
          <p className="text-3xl font-bold text-[#FFD028]">{stats.subscribers.total}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">平均客單價</p>
          <p className="text-3xl font-bold text-slate-900">
            {stats.orders.paid > 0
              ? formatCurrency(Math.round(stats.orders.totalRevenue / stats.orders.paid), stats.orders.currency)
              : '-'}
          </p>
        </div>
      </div>

      {/* Tier & Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">票種分布</h2>
          {Object.entries(stats.orders.byTier).length === 0 ? (
            <p className="text-sm text-slate-400">尚無資料</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.orders.byTier).map(([tier, count]) => (
                <div key={tier} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{TIER_LABELS[tier] || tier}</span>
                  <span className="font-semibold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">訂單狀態</h2>
          {Object.entries(stats.orders.byStatus).length === 0 ? (
            <p className="text-sm text-slate-400">尚無資料</p>
          ) : (
            <div className="space-y-3">
              {STATUS_ORDER
                .filter((status) => stats.orders.byStatus[status] != null)
                .map((status) => {
                  const count = stats.orders.byStatus[status];
                  const pct = stats.orders.total > 0 ? Math.round((count / stats.orders.total) * 100) : 0;
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[status] || status}
                        </span>
                        <span className="text-sm text-slate-900 font-semibold">{count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-slate-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
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
        <Link href="/admin/subscribers" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
          <h3 className="font-semibold text-slate-900 group-hover:text-[#10B8D9] transition-colors">訂閱者管理 →</h3>
          <p className="text-sm text-slate-500 mt-1">查看電子報訂閱者</p>
        </Link>
        <Link href="/admin/send" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
          <h3 className="font-semibold text-slate-900 group-hover:text-[#10B8D9] transition-colors">發送通知 →</h3>
          <p className="text-sm text-slate-500 mt-1">批次發送通知信給會員</p>
        </Link>
      </div>
    </div>
  );
}
