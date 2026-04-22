'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Week {
  id: number;
  code: string;
  starts_on: string;
  ends_on: string;
  price_twd: number;
  room_capacity: number;
  status: string;
  waitlist_offer_expires_in_minutes: number;
}

interface BookingWeekLite {
  week_id: number;
  status: string;
}

interface WaitlistLite {
  week_id: number;
  status: string;
}

interface TransferLite {
  status: string;
}

interface SummaryResponse {
  weeks: Week[];
  bookingWeeks: BookingWeekLite[];
  waitlist: WaitlistLite[];
  transfers: TransferLite[];
}

const ACTIVE_BOOKING_STATUSES = new Set(['confirmed', 'modified_in', 'pending_transfer']);

export default function StayAdminDashboard() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/stay/summary')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setSummary(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'load_failed'))
      .finally(() => setLoading(false));
  }, []);

  const pendingTransfers = summary?.transfers.filter((t) => t.status === 'pending_acceptance').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">住宿 Stay 總覽</h1>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/admin/stay/bookings" className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors">
            訂房列表
          </Link>
          <Link href="/admin/stay/weeks" className="px-3 py-1.5 bg-white border border-slate-200 hover:border-cyan-500 text-slate-700 rounded-lg transition-colors">
            週次管理
          </Link>
          <Link href="/admin/stay/invite-codes" className="px-3 py-1.5 bg-white border border-slate-200 hover:border-cyan-500 text-slate-700 rounded-lg transition-colors">
            邀請碼
          </Link>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">載入中...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && (
        <>
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="py-2 px-3 text-left">週次</th>
                  <th className="py-2 px-3 text-left">日期</th>
                  <th className="py-2 px-3 text-right">單價 TWD</th>
                  <th className="py-2 px-3 text-right">房間容量</th>
                  <th className="py-2 px-3 text-right">已確認</th>
                  <th className="py-2 px-3 text-right">候補 (active)</th>
                  <th className="py-2 px-3 text-left">狀態</th>
                  <th className="py-2 px-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {summary.weeks.map((w) => {
                  const confirmed = summary.bookingWeeks.filter(
                    (bw) => bw.week_id === w.id && ACTIVE_BOOKING_STATUSES.has(bw.status),
                  ).length;
                  const waitlist = summary.waitlist.filter(
                    (wl) => wl.week_id === w.id && wl.status === 'active',
                  ).length;
                  return (
                    <tr key={w.id} className="border-t border-slate-100">
                      <td className="py-2 px-3 font-mono text-slate-800">{w.code}</td>
                      <td className="py-2 px-3 text-slate-600">
                        {w.starts_on} – {w.ends_on}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{w.price_twd.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{w.room_capacity}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold text-cyan-600">{confirmed}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-700">{waitlist}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            w.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : w.status === 'sold_out'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {w.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <a
                          href={`/api/admin/stay/weeks/${w.id}/export`}
                          download
                          className="inline-block px-2.5 py-1 text-xs bg-cyan-500 hover:bg-cyan-600 text-white rounded transition-colors"
                        >
                          匯出名單
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">訂房週數 (active)</p>
              <p className="text-2xl font-bold text-slate-900">
                {summary.bookingWeeks.filter((b) => ACTIVE_BOOKING_STATUSES.has(b.status)).length}
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">候補中</p>
              <p className="text-2xl font-bold text-slate-900">
                {summary.waitlist.filter((w) => w.status === 'active').length}
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">待接受轉讓</p>
              <p className="text-2xl font-bold text-slate-900">{pendingTransfers}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
