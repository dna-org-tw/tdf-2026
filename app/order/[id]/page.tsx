'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent } from '@/components/FacebookPixel';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<{
    id: string;
    status: string | null;
    payment_status: string | null;
    amount_subtotal: number | null;
    amount_total: number | null;
    amount_tax: number | null;
    amount_discount: number | null;
    currency: string | null;
    customer_email: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    customer_address: {
      line1: string | null;
      line2: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
      country: string | null;
    } | null;
    created: number | null;
    payment_method_brand?: string | null;
    payment_method_last4?: string | null;
    payment_method_type?: string | null;
    payment_intent_id?: string | null;
    invoice?: string | null;
    ticket_tier?: string | null;
    line_items?: Array<{
      id: string;
      description: string | null;
      amount: number | null;
      currency: string | null;
      quantity: number | null;
      price_unit: number | null;
      product_name: string | null;
      product_description: string | null;
    }>;
    discount?: {
      amount: number;
      amount_tax: number;
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/checkout/session?id=${encodeURIComponent(orderId)}`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: t.checkout?.loadOrderError || 'Failed to load order' }));
          throw new Error(errorData.error || t.checkout?.loadOrderError || 'Failed to load order');
        }
        const data = await res.json();
        const orderData = {
          id: data.id,
          status: data.status ?? null,
          payment_status: data.payment_status ?? null,
          amount_subtotal: typeof data.amount_subtotal === 'number' ? data.amount_subtotal : null,
          amount_total: typeof data.amount_total === 'number' ? data.amount_total : null,
          amount_tax: typeof data.amount_tax === 'number' ? data.amount_tax : null,
          amount_discount: typeof data.amount_discount === 'number' ? data.amount_discount : null,
          currency: data.currency ?? null,
          customer_email: data.customer_email ?? null,
          customer_name: data.customer_name ?? null,
          customer_phone: data.customer_phone ?? null,
          customer_address: data.customer_address ?? null,
          created: typeof data.created === 'number' ? data.created : null,
          payment_method_brand: data.payment_method_brand ?? null,
          payment_method_last4: data.payment_method_last4 ?? null,
          payment_method_type: data.payment_method_type ?? null,
          payment_intent_id: data.payment_intent_id ?? null,
          invoice: data.invoice ?? null,
          ticket_tier: data.ticket_tier ?? null,
          line_items: Array.isArray(data.line_items) ? data.line_items : null,
          discount: data.discount ?? null,
        };
        setOrder(orderData);
        
        // Track ViewContent event for order detail page
        trackEvent('ViewContent', {
          content_name: 'Order Details',
          content_category: 'Order',
          content_ids: [orderData.id],
          value: orderData.amount_total ? orderData.amount_total / 100 : undefined,
          currency: orderData.currency?.toUpperCase(),
        });
      } catch (err) {
        console.error('Failed to load order details', err);
        setError(
          err instanceof Error
            ? err.message
            : t.checkout?.orderError ?? 'Unable to load order details.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, t.checkout]);

  const tierLabel =
    order?.ticket_tier &&
    t.tickets?.[order.ticket_tier as 'explore' | 'contribute' | 'backer']?.label;

  const isPaid = order?.payment_status === 'paid';

  return (
    <main className="min-h-screen bg-[#1E1F1C] text-white flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              isPaid
                ? 'bg-emerald-500/10 border border-emerald-400/40'
                : 'bg-amber-500/10 border border-amber-400/40'
            }`}
          >
            <span className="text-3xl">{isPaid ? '✅' : '⚠️'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {t.orderDetail?.title ?? 'Order Details'}
          </h1>
          {order && (
            <p className="text-white/70 text-sm">
              {t.orderDetail?.orderIdLabel ?? 'Order ID'}:{' '}
              <span className="font-mono">{order.id}</span>
            </p>
          )}
        </div>

        {loading && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-white/70">
              {t.checkout?.orderLoading ?? 'Loading your order details...'}
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => router.push('/order/query')}
              className="mt-4 px-6 py-2 rounded-lg bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-all"
            >
              {t.orderDetail?.tryQueryAgain ?? 'Try Query Again'}
            </button>
          </div>
        )}

        {order && !loading && !error && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
            {/* Payment Status */}
            {order.payment_status && (
              <div className="pb-4 border-b border-white/10">
                <p className="text-white/70 text-xs uppercase tracking-wide mb-2">
                  {t.checkout?.orderStatusLabel ?? 'Payment status'}
                </p>
                <p
                  className={`font-semibold text-lg ${
                    isPaid ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {isPaid ? '✓ Paid' : order.payment_status}
                </p>
              </div>
            )}

            {/* Ticket Tier */}
            {order.ticket_tier && (
              <div className="pb-4 border-b border-white/10">
                <p className="text-white/70 text-xs uppercase tracking-wide mb-2">
                  {t.orderDetail?.ticketTierLabel ?? 'Ticket Tier'}
                </p>
                <p className="text-white font-semibold">
                  {tierLabel || order.ticket_tier.toUpperCase()}
                </p>
              </div>
            )}

            {/* Line Items */}
            {order.line_items && order.line_items.length > 0 && (
              <div>
                <p className="text-white/70 text-xs uppercase tracking-wide mb-3">
                  {t.checkout?.orderItemsLabel ?? 'Items'}
                </p>
                <div className="space-y-3">
                  {order.line_items.map((item, idx) => (
                    <div key={item.id || idx} className="bg-white/5 rounded-lg p-4">
                      <p className="text-white font-medium">
                        {item.product_name || item.description || `${t.checkout?.orderItemPrefix || 'Item'} ${idx + 1}`}
                      </p>
                      {item.product_description && (
                        <p className="text-white/60 text-xs mt-1">{item.product_description}</p>
                      )}
                      <div className="flex justify-between items-center mt-3 text-sm">
                        <span className="text-white/70">
                          {t.checkout?.orderItemQuantity ?? 'Quantity'}: {item.quantity || 1}
                        </span>
                        {item.amount != null && item.currency && (
                          <span className="text-white font-semibold">
                            {t.checkout?.orderItemPrice ?? 'Price'}:{' '}
                            {(item.amount / 100).toFixed(2)} {item.currency.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing Breakdown */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              {order.amount_subtotal != null && order.currency && (
                <div className="flex justify-between text-white/80">
                  <span>{t.checkout?.orderSubtotalLabel ?? 'Subtotal'}:</span>
                  <span>
                    {(order.amount_subtotal / 100).toFixed(2)} {order.currency.toUpperCase()}
                  </span>
                </div>
              )}
              {order.amount_discount != null && order.amount_discount > 0 && order.currency && (
                <div className="flex justify-between text-emerald-400">
                  <span>{t.checkout?.orderDiscountLabel ?? 'Discount'}:</span>
                  <span>
                    -{(order.amount_discount / 100).toFixed(2)} {order.currency.toUpperCase()}
                  </span>
                </div>
              )}
              {order.amount_tax != null && order.amount_tax > 0 && order.currency && (
                <div className="flex justify-between text-white/80">
                  <span>{t.checkout?.orderTaxLabel ?? 'Tax'}:</span>
                  <span>
                    {(order.amount_tax / 100).toFixed(2)} {order.currency.toUpperCase()}
                  </span>
                </div>
              )}
              {order.amount_total != null && order.currency && (
                <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-white/10">
                  <span>{t.checkout?.orderAmountLabel ?? 'Total amount'}:</span>
                  <span>
                    {(order.amount_total / 100).toFixed(2)} {order.currency.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Customer Information */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              {order.customer_email && (
                <p className="text-white/80">
                  <span className="text-white/60">
                    {t.checkout?.orderEmailLabel ?? 'Confirmation sent to'}:
                  </span>{' '}
                  <span className="font-mono break-all">{order.customer_email}</span>
                </p>
              )}
              {order.customer_name && (
                <p className="text-white/80">
                  <span className="text-white/60">
                    {t.checkout?.orderNameLabel ?? 'Customer name'}:
                  </span>{' '}
                  <span>{order.customer_name}</span>
                </p>
              )}
              {order.customer_phone && (
                <p className="text-white/80">
                  <span className="text-white/60">
                    {t.checkout?.orderPhoneLabel ?? 'Phone'}:
                  </span>{' '}
                  <span>{order.customer_phone}</span>
                </p>
              )}
              {order.customer_address && (
                <div className="text-white/80">
                  <span className="text-white/60">
                    {t.checkout?.orderAddressLabel ?? 'Billing address'}:
                  </span>
                  <div className="mt-1 font-mono text-xs">
                    {order.customer_address.line1 && <div>{order.customer_address.line1}</div>}
                    {order.customer_address.line2 && <div>{order.customer_address.line2}</div>}
                    <div>
                      {[
                        order.customer_address.city,
                        order.customer_address.state,
                        order.customer_address.postal_code,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                    {order.customer_address.country && (
                      <div>{order.customer_address.country}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method */}
            {order.payment_method_last4 && (
              <div className="pt-4 border-t border-white/10">
                <p className="text-white/70">
                  {t.checkout?.orderCardLabel ?? 'Paid with card ending in'}{' '}
                  <span className="font-mono">**** {order.payment_method_last4}</span>
                  {order.payment_method_brand && ` (${order.payment_method_brand})`}
                </p>
              </div>
            )}

            {/* Order Time */}
            {order.created && (
              <div className="pt-4 border-t border-white/10">
                <p className="text-white/70 text-sm">
                  {t.checkout?.orderTimeLabel ?? 'Order time'}:{' '}
                  {new Date(order.created * 1000).toLocaleString()}
                </p>
              </div>
            )}

            {/* Order IDs */}
            <div className="pt-4 border-t border-white/10 space-y-1">
              {order.payment_intent_id && (
                <p className="text-white/60 text-xs">
                  {t.checkout?.orderPaymentIntentLabel ?? 'Payment intent ID'}:{' '}
                  <span className="font-mono break-all">{order.payment_intent_id}</span>
                </p>
              )}
              {order.invoice && (
                <p className="text-white/60 text-xs">
                  {t.checkout?.orderInvoiceLabel ?? 'Invoice'}:{' '}
                  <span className="font-mono break-all">{order.invoice}</span>
                </p>
              )}
            </div>
          </div>
        )}

        <div className="pt-6 text-center space-x-4">
          <button
            onClick={() => router.push('/order/query')}
            className="px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all duration-200"
          >
            {t.orderDetail?.queryAnother ?? 'Query Another Order'}
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {t.checkout?.backToHome ?? 'Back to homepage'}
          </button>
        </div>
      </div>
    </main>
  );
}
