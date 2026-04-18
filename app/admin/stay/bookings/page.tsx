'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface BookingWeek {
  id: string;
  status: string;
  booked_price_twd: number;
  week_id: number;
  stay_weeks?: { code: string } | null;
}

interface Booking {
  id: string;
  created_at: string;
  member_id: number;
  primary_guest_name: string;
  primary_guest_email: string;
  booking_type: string;
  status: string;
  stay_booking_weeks?: BookingWeek[] | null;
}

export default function StayBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/stay/bookings')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setBookings(data.bookings ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'load_failed'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">訂房列表</h1>
        <Link href="/admin/stay" className="text-sm text-slate-500 hover:text-cyan-600">
          ← 回總覽
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-500">載入中...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="py-2 px-3 text-left">建立時間</th>
                <th className="py-2 px-3 text-left">Member</th>
                <th className="py-2 px-3 text-left">主住客</th>
                <th className="py-2 px-3 text-left">Email</th>
                <th className="py-2 px-3 text-left">類型</th>
                <th className="py-2 px-3 text-left">狀態</th>
                <th className="py-2 px-3 text-right">週數</th>
                <th className="py-2 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="py-2 px-3 text-slate-600 tabular-nums">
                    {new Date(b.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-slate-700">#{b.member_id}</td>
                  <td className="py-2 px-3 text-slate-900">{b.primary_guest_name}</td>
                  <td className="py-2 px-3 text-slate-600">{b.primary_guest_email}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        b.booking_type === 'complimentary'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-cyan-100 text-cyan-700'
                      }`}
                    >
                      {b.booking_type}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-700">{b.status}</td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {b.stay_booking_weeks?.length ?? 0}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <Link
                      href={`/admin/stay/bookings/${b.id}`}
                      className="text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      檢視 →
                    </Link>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-sm">
                    尚無訂房資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
