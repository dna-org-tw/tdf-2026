'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import TransferOrderModal from '@/components/order/TransferOrderModal';

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
  parent_order_id: string | null;
}

interface TransferInfo {
  canTransfer: boolean;
  reasonCode:
    | 'ok'
    | 'not_paid'
    | 'is_child_order'
    | 'no_email'
    | 'deadline_passed'
    | 'pending_child';
  deadline: string | null;
}

interface TransferHistoryRow {
  id: string;
  from_email: string;
  to_email: string;
  initiated_by: 'user' | 'admin';
  transferred_at: string;
  parent_transfer_id: string | null;
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
  const { t, lang } = useTranslation();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [transfer, setTransfer] = useState<TransferInfo | null>(null);
  const [transfers, setTransfers] = useState<TransferHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferToast, setTransferToast] = useState('');

  const fetchOrder = async () => {
    try {
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
      setTransfer(data.transfer ?? null);
      setTransfers(data.transfers ?? []);
    } catch {
      setError(t.auth.errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/me');
      return;
    }
    if (!orderId) return;
    setLoading(true);
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, user, authLoading, router]);

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

          {order && transfers.length > 0 && (
            <div className="mt-4 bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-900 mb-3">
                {lang === 'zh' ? '轉讓紀錄' : 'Transfer history'}
              </h2>
              <ul className="space-y-3">
                {transfers.map((t) => {
                  const userEmail = user?.email?.toLowerCase() ?? '';
                  const isOutgoing = t.from_email.toLowerCase() === userEmail;
                  return (
                    <li key={t.id} className="border-l-2 border-amber-400 pl-3 space-y-1 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-1.5 py-0.5 text-xs rounded border ${
                          isOutgoing
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-green-50 text-green-700 border-green-200'
                        }`}>
                          {isOutgoing
                            ? (lang === 'zh' ? '您轉出' : 'You transferred out')
                            : (lang === 'zh' ? '您收到' : 'You received')}
                        </span>
                        {t.initiated_by === 'admin' && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-amber-50 text-amber-800 border border-amber-200">
                            {lang === 'zh' ? '管理員執行' : 'by admin'}
                          </span>
                        )}
                        {t.parent_transfer_id && (
                          <span className="text-[10px] text-slate-500 bg-stone-100 px-1.5 py-0.5 rounded">
                            {lang === 'zh' ? '連帶轉讓' : 'with parent'}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-slate-400">
                          {new Date(t.transferred_at).toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-600 break-all">
                        {t.from_email} <span className="text-slate-400">→</span> {t.to_email}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {order && (
            <div className="mt-4 bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-900 mb-1">
                {lang === 'zh' ? '轉讓訂單' : 'Transfer order'}
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                {lang === 'zh'
                  ? '把此訂單的所有權轉給另一位朋友。此操作無法復原。'
                  : 'Hand this order over to a friend. This action cannot be undone.'}
                {transfer?.deadline && (
                  <>
                    {' '}
                    {lang === 'zh' ? '截止：' : 'Closes on '}
                    <span className="font-mono text-slate-700">
                      {new Date(transfer.deadline).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </span>
                    {' '}
                    <span className="font-mono text-slate-500">
                      ({new Date(transfer.deadline).toLocaleTimeString(lang === 'zh' ? 'zh-TW' : 'en-US', {
                        hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short',
                      })})
                    </span>
                    {'.'}
                  </>
                )}
              </p>

              {transfer?.canTransfer ? (
                <button
                  type="button"
                  onClick={() => setTransferOpen(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] hover:bg-[#0EA5C4] rounded-lg transition-colors"
                >
                  {lang === 'zh' ? '轉讓訂單' : 'Transfer this order'}
                </button>
              ) : (
                <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-200">
                  {transfer?.reasonCode === 'is_child_order' && (
                    <>
                      {lang === 'zh'
                        ? '這是升級訂單（子訂單），無法單獨轉讓。請到母訂單頁面進行轉讓，升級部分會一併轉移。'
                        : 'This is an upgrade (child) order and cannot be transferred alone. Transfer the parent order — the upgrade follows automatically.'}
                      {order.parent_order_id && (
                        <>
                          {' '}
                          <Link href={`/order/${order.parent_order_id}`} className="text-[#10B8D9] hover:underline">
                            {lang === 'zh' ? '前往母訂單 →' : 'Go to parent order →'}
                          </Link>
                        </>
                      )}
                    </>
                  )}
                  {transfer?.reasonCode === 'not_paid' && (lang === 'zh' ? '僅已付款訂單可轉讓。' : 'Only paid orders can be transferred.')}
                  {transfer?.reasonCode === 'no_email' && (lang === 'zh' ? '訂單缺少 email 資訊，無法轉讓。' : 'Order has no email — cannot transfer.')}
                  {transfer?.reasonCode === 'deadline_passed' && (lang === 'zh' ? '轉讓已截止，如需協助請聯絡客服。' : 'Transfer deadline has passed. Please contact support for assistance.')}
                  {transfer?.reasonCode === 'pending_child' && (lang === 'zh' ? '有升級訂單尚未完成，請先處理後再轉讓。' : 'There is a pending upgrade on this order; resolve it first.')}
                </div>
              )}
            </div>
          )}
        </div>

        {order && transferOpen && (
          <TransferOrderModal
            open={transferOpen}
            onClose={() => setTransferOpen(false)}
            onSuccess={(result) => {
              setTransferOpen(false);
              setTransferToast(
                lang === 'zh'
                  ? `已轉讓至 ${result.to_email}，3 秒後返回。`
                  : `Transferred to ${result.to_email}. Returning to orders…`,
              );
              setTimeout(() => router.push('/me'), 3000);
            }}
            order={{
              id: order.id,
              ticket_tier: order.ticket_tier,
              customer_email: order.customer_email,
            }}
            endpoint="/api/order/transfer"
            mode="user"
            hasChildOrders={false}
          />
        )}

        {transferToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
            {transferToast}
          </div>
        )}
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
