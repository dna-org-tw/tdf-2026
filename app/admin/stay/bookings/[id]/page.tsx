'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Week {
  id: number;
  code: string;
  starts_on: string;
  ends_on: string;
}

interface BookingWeek {
  id: string;
  status: string;
  booked_price_twd: number;
  stay_weeks?: Week | null;
}

interface Guarantee {
  guarantee_type: string;
  card_brand: string | null;
  card_last4: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
}

interface Booking {
  id: string;
  created_at: string;
  member_id: number;
  primary_guest_name: string;
  primary_guest_email: string;
  primary_guest_phone: string;
  guest_count: number;
  second_guest_name: string | null;
  booking_type: string;
  status: string;
  internal_notes: string | null;
  stay_booking_weeks?: BookingWeek[] | null;
  stay_guarantees?: Guarantee[] | null;
}

interface Transfer {
  id: string;
  booking_week_id: string;
  to_email: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface ChargeAttempt {
  id: string;
  booking_week_id: string;
  reason: string;
  amount_twd: number;
  status: string;
  stripe_payment_intent_id: string | null;
  error_message: string | null;
  created_at: string;
}

interface BookingDetailResponse {
  booking: Booking;
  transfers: Transfer[];
  charges: ChargeAttempt[];
}

export default function StayBookingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<BookingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/admin/stay/bookings/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => setData(d))
      .catch((err) => setError(err instanceof Error ? err.message : 'load_failed'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function markNoShow(bookingWeekId: string) {
    if (!confirm('確認標記為 no-show 並收取保證金？')) return;
    setBusy(true);
    setActionMsg(null);
    setActionErr(null);
    try {
      const res = await fetch(`/api/admin/stay/bookings/${bookingWeekId}/no-show`, { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'failed');
      setActionMsg('已標記 no-show 並扣款');
      load();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  async function convertToComp() {
    if (!id) return;
    if (!confirm('確定要將此訂房轉為 complimentary？')) return;
    setBusy(true);
    setActionMsg(null);
    setActionErr(null);
    try {
      const res = await fetch(`/api/admin/stay/bookings/${id}/comp`, { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'failed');
      setActionMsg('已轉為 complimentary');
      load();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  async function resendTransfer(transferId: string) {
    setBusy(true);
    setActionMsg(null);
    setActionErr(null);
    try {
      const res = await fetch(`/api/admin/stay/transfers/${transferId}/resend`, { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'failed');
      setActionMsg('已重新寄出轉讓信');
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  const booking = data?.booking;
  const guarantee = booking?.stay_guarantees?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">訂房詳情</h1>
        <Link href="/admin/stay/bookings" className="text-sm text-slate-500 hover:text-cyan-600">
          ← 回訂房列表
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-500">載入中...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionMsg && <p className="text-sm text-green-600">{actionMsg}</p>}
      {actionErr && <p className="text-sm text-red-600">{actionErr}</p>}

      {booking && (
        <>
          <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="font-semibold text-slate-900">主住客資訊</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">ID</p>
                <p className="font-mono text-slate-800 break-all">{booking.id}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Member</p>
                <p className="text-slate-800">#{booking.member_id}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">類型</p>
                <p className="text-slate-800">{booking.booking_type}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">狀態</p>
                <p className="text-slate-800">{booking.status}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">姓名</p>
                <p className="text-slate-800">{booking.primary_guest_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-slate-800">{booking.primary_guest_email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="text-slate-800">{booking.primary_guest_phone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">住客數</p>
                <p className="text-slate-800">
                  {booking.guest_count}
                  {booking.second_guest_name && ` (+${booking.second_guest_name})`}
                </p>
              </div>
            </div>
            {booking.internal_notes && (
              <div className="text-xs text-slate-500 border-t border-slate-100 pt-2">
                註記：{booking.internal_notes}
              </div>
            )}
            <div className="pt-2">
              <button
                onClick={convertToComp}
                disabled={busy || booking.booking_type === 'complimentary'}
                className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                轉為 complimentary
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-3">保證金 Guarantee</h2>
            {guarantee ? (
              <div className="text-sm text-slate-700 space-y-1">
                <p>類型：{guarantee.guarantee_type}</p>
                {guarantee.guarantee_type === 'stripe_card' && (
                  <p>
                    卡片：{guarantee.card_brand ?? '—'} •••• {guarantee.card_last4 ?? '—'}
                  </p>
                )}
                {guarantee.stripe_customer_id && (
                  <p className="text-xs text-slate-500">customer: {guarantee.stripe_customer_id}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">無保證金紀錄</p>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-3">訂房週 Booking Weeks</h2>
            <ul className="divide-y divide-slate-100">
              {(booking.stay_booking_weeks ?? []).map((bw) => (
                <li key={bw.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-slate-800">
                      {bw.stay_weeks?.code ?? `week #${bw.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {bw.stay_weeks?.starts_on} – {bw.stay_weeks?.ends_on} · 狀態：{bw.status} · NT$
                      {bw.booked_price_twd.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => markNoShow(bw.id)}
                    disabled={busy || bw.status === 'no_show' || bw.status === 'cancelled'}
                    className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    標記 No-show
                  </button>
                </li>
              ))}
              {(booking.stay_booking_weeks ?? []).length === 0 && (
                <li className="py-3 text-sm text-slate-400">尚無週次</li>
              )}
            </ul>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-3">轉讓紀錄 Transfers</h2>
            {(data?.transfers ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">無紀錄</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data?.transfers.map((t) => (
                  <li key={t.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="text-slate-800">
                        → {t.to_email} · <span className="text-slate-500">{t.status}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        建立 {new Date(t.created_at).toLocaleString()} · 到期{' '}
                        {new Date(t.expires_at).toLocaleString()}
                      </p>
                    </div>
                    {t.status === 'pending_acceptance' && (
                      <button
                        onClick={() => resendTransfer(t.id)}
                        disabled={busy}
                        className="px-2.5 py-1 text-xs bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white rounded"
                      >
                        重寄信
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-3">扣款紀錄 Charges</h2>
            {(data?.charges ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">無紀錄</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {data?.charges.map((c) => (
                  <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-slate-800">
                        {c.reason} · NT${c.amount_twd.toLocaleString()} ·{' '}
                        <span
                          className={
                            c.status === 'succeeded'
                              ? 'text-green-600'
                              : c.status === 'failed'
                              ? 'text-red-600'
                              : 'text-slate-500'
                          }
                        >
                          {c.status}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(c.created_at).toLocaleString()}
                        {c.stripe_payment_intent_id && ` · ${c.stripe_payment_intent_id}`}
                        {c.error_message && ` · ${c.error_message}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
