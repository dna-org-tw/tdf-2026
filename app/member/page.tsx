'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import type { Order } from '@/lib/types/order';
import {
  TICKET_TIER_RANK,
  TICKET_TIER_LABELS,
  TICKET_TIER_BADGE_CLASSES,
  type TicketTier,
} from '@/lib/members';

function LoginForm() {
  const { t } = useTranslation();
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }

      setStep('code');
      setCode('');
    } catch {
      setError(t.auth.errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setVerifying(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });

      if (!res.ok) {
        throw new Error('Invalid code');
      }

      await refreshSession();
    } catch {
      setError(t.auth.invalidCode);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      setCode('');
    } catch {
      setError(t.auth.errorMessage);
    } finally {
      setSending(false);
    }
  };

  if (step === 'code') {
    return (
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center">{t.auth.codeSentTitle}</h1>
        <p className="text-slate-600 mb-8 text-center">{t.auth.codeSentMessage}</p>

        <form onSubmit={handleVerifyCode} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t.auth.codePlaceholder}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent text-slate-900 text-center text-2xl tracking-[0.3em] font-mono"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {verifying ? t.auth.verifying : t.auth.verifyCode}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={handleResend}
            disabled={sending}
            className="text-sm text-[#10B8D9] hover:underline disabled:opacity-50"
          >
            {sending ? t.auth.sending : t.auth.resendCode}
          </button>
        </div>
        <div className="mt-2 text-center">
          <button
            onClick={() => { setStep('email'); setError(''); setCode(''); }}
            className="text-sm text-slate-500 hover:underline"
          >
            {email}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center">{t.auth.loginTitle}</h1>
      <p className="text-slate-600 mb-8 text-center">{t.auth.loginDescription}</p>

      <form onSubmit={handleSendCode} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.auth.emailPlaceholder}
          required
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent text-slate-900"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {sending ? t.auth.sending : t.auth.sendCode}
        </button>
      </form>
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: ReturnType<typeof useTranslation>['t'] }) {
  const statusMap: Record<string, { label: string; color: string }> = {
    paid: { label: t.auth.statusPaid, color: 'bg-green-100 text-green-700' },
    pending: { label: t.auth.statusPending, color: 'bg-yellow-100 text-yellow-700' },
    failed: { label: t.auth.statusFailed, color: 'bg-red-100 text-red-700' },
    cancelled: { label: t.auth.statusCancelled, color: 'bg-slate-100 text-slate-600' },
    refunded: { label: t.auth.statusRefunded, color: 'bg-purple-100 text-purple-700' },
  };
  const { label, color } = statusMap[status] || { label: status, color: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

function MemberDashboard() {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;

    const fetchOrders = async () => {
      try {
        const res = await fetch(`/api/auth/orders?email=${encodeURIComponent(user.email!)}`);

        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders);
        }
      } catch (err) {
        console.error('[Member] Failed to fetch orders:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user?.email]);

  const highestTier = useMemo<TicketTier | null>(() => {
    const paidTiers = orders
      .filter((o) => o.status === 'paid')
      .map((o) => o.ticket_tier);
    if (paidTiers.length === 0) return null;
    return paidTiers.reduce((best, curr) =>
      TICKET_TIER_RANK[curr] > TICKET_TIER_RANK[best] ? curr : best
    );
  }, [orders]);

  const formatAmount = (amount: number, currency: string) => {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* User Info */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t.auth.memberTitle}</h1>
          <p className="text-slate-500 mt-1">{user?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="text-sm text-slate-500 hover:text-red-500 transition-colors font-medium"
        >
          {t.auth.logout}
        </button>
      </div>

      {/* Current Ticket Tier */}
      {!loading && (
        <div className="mb-8 bg-white rounded-xl p-6 shadow-sm flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-500 mb-1">{t.auth.yourTier}</p>
            {highestTier ? (
              <span
                className={`inline-block px-3 py-1 rounded-full text-base font-semibold ${TICKET_TIER_BADGE_CLASSES[highestTier]}`}
              >
                {TICKET_TIER_LABELS[highestTier]}
              </span>
            ) : (
              <p className="text-slate-600">{t.auth.noPaidTier}</p>
            )}
          </div>
        </div>
      )}

      {/* Order History */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">{t.auth.orderHistory}</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <p className="text-slate-500">{t.auth.noOrders}</p>
            <Link
              href="/#tickets"
              className="inline-block mt-4 bg-[#10B8D9] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#0EA5C4] transition-colors"
            >
              {t.nav.tickets}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/member/order/${order.id}`}
                className="block bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900 capitalize">
                        {order.ticket_tier}
                      </span>
                      <StatusBadge status={order.status} t={t} />
                    </div>
                    <p className="text-sm text-slate-500">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-slate-900">
                      {formatAmount(order.amount_total, order.currency)}
                    </p>
                    <p className="text-xs text-[#10B8D9] mt-1">{t.auth.viewDetails} →</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="pt-32 pb-16 px-6">
        {user ? <MemberDashboard /> : <LoginForm />}
      </main>
      <Footer />
    </div>
  );
}

export default function MemberPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </div>
      }
    >
      <MemberContent />
    </Suspense>
  );
}
