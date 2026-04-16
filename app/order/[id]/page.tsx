'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

interface OrderDetail {
  id: string;
  stripe_session_id: string;
  ticket_tier: string | null;
  status: string;
  amount_subtotal: number | null;
  amount_total: number | null;
  amount_tax: number | null;
  amount_discount: number | null;
  currency: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  payment_method_type: string | null;
  created_at: string;
}

function StatusBadge({ status, t }: { status: string; t: ReturnType<typeof useTranslation>['t'] }) {
  const statusMap: Record<string, { label: string; color: string }> = {
    paid: { label: t.auth.statusPaid, color: 'bg-green-100 text-green-700' },
    pending: { label: t.auth.statusPending, color: 'bg-yellow-100 text-yellow-700' },
    failed: { label: t.auth.statusFailed, color: 'bg-red-100 text-red-700' },
    cancelled: { label: t.auth.statusCancelled, color: 'bg-slate-100 text-slate-600' },
    refunded: { label: t.auth.statusRefunded, color: 'bg-purple-100 text-purple-700' },
    expired: { label: t.auth.statusExpired, color: 'bg-slate-100 text-slate-500' },
  };
  const { label, color } = statusMap[status] || { label: status, color: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

function MemberOrderDetail() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/me');
      return;
    }
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/auth/orders/${encodeURIComponent(orderId)}`);
        if (res.status === 401) {
          router.push('/me');
          return;
        }
        if (!res.ok) {
          throw new Error('Failed to load order');
        }
        const data = await res.json();
        setOrder(data.order);
      } catch {
        setError(t.auth.errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, user, authLoading, router, t.auth.errorMessage]);

  const formatAmount = (amount: number, currency: string) => {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="pt-32 pb-16 px-6">
        <div className="w-full max-w-2xl mx-auto">
          {/* Back link */}
          <Link
            href="/me"
            className="inline-flex items-center text-sm text-[#10B8D9] hover:underline mb-6"
          >
            ← {t.auth.orderHistory}
          </Link>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <p className="text-red-600">{error}</p>
              <Link
                href="/me"
                className="inline-block mt-4 text-[#10B8D9] hover:underline text-sm"
              >
                {t.auth.orderHistory}
              </Link>
            </div>
          )}

          {order && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                      {order.ticket_tier
                        ? (t.tickets?.[order.ticket_tier as 'explore' | 'contribute' | 'weekly_backer' | 'backer']?.label || order.ticket_tier.toUpperCase())
                        : t.auth.orderHistory}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">{formatDate(order.created_at)}</p>
                  </div>
                  <StatusBadge status={order.status} t={t} />
                </div>
              </div>

              {/* Amount */}
              <div className="p-6 border-b border-slate-100 space-y-2">
                {order.amount_subtotal != null && (
                  <div className="flex justify-between text-slate-600">
                    <span>{t.checkout?.orderSubtotalLabel ?? 'Subtotal'}</span>
                    <span>{formatAmount(order.amount_subtotal, order.currency)}</span>
                  </div>
                )}
                {order.amount_discount != null && order.amount_discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{t.checkout?.orderDiscountLabel ?? 'Discount'}</span>
                    <span>-{formatAmount(order.amount_discount, order.currency)}</span>
                  </div>
                )}
                {order.amount_tax != null && order.amount_tax > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>{t.checkout?.orderTaxLabel ?? 'Tax'}</span>
                    <span>{formatAmount(order.amount_tax, order.currency)}</span>
                  </div>
                )}
                {order.amount_total != null && (
                  <div className="flex justify-between font-bold text-slate-900 text-lg pt-2 border-t border-slate-100">
                    <span>{t.checkout?.orderAmountLabel ?? 'Total'}</span>
                    <span>{formatAmount(order.amount_total, order.currency)}</span>
                  </div>
                )}
              </div>

              {/* Customer Info */}
              <div className="p-6 border-b border-slate-100 space-y-3">
                {order.customer_name && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{t.checkout?.orderNameLabel ?? 'Name'}</p>
                    <p className="text-slate-900">{order.customer_name}</p>
                  </div>
                )}
                {order.customer_email && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{t.checkout?.orderEmailLabel ?? 'Email'}</p>
                    <p className="text-slate-900 font-mono text-sm">{order.customer_email}</p>
                  </div>
                )}
                {order.customer_phone && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{t.checkout?.orderPhoneLabel ?? 'Phone'}</p>
                    <p className="text-slate-900">{order.customer_phone}</p>
                  </div>
                )}
                {order.customer_address && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{t.checkout?.orderAddressLabel ?? 'Address'}</p>
                    <div className="text-slate-900 text-sm">
                      {order.customer_address.line1 && <p>{order.customer_address.line1}</p>}
                      {order.customer_address.line2 && <p>{order.customer_address.line2}</p>}
                      <p>
                        {[order.customer_address.city, order.customer_address.state, order.customer_address.postal_code]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      {order.customer_address.country && <p>{order.customer_address.country}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              {order.payment_method_last4 && (
                <div className="p-6">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{t.checkout?.orderCardLabel ?? 'Payment Method'}</p>
                  <p className="text-slate-900">
                    **** {order.payment_method_last4}
                    {order.payment_method_brand && ` (${order.payment_method_brand})`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function MemberOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </div>
      }
    >
      <MemberOrderDetail />
    </Suspense>
  );
}
