'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent } from '@/components/FacebookPixel';

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');
  const tier = (searchParams.get('tier') || '').toLowerCase() as
    | 'explore'
    | 'contribute'
    | 'backer'
    | '';

  useEffect(() => {
    trackEvent('ViewContent', {
      content_name: 'Checkout Success',
      content_category: 'Checkout',
      tier: tier || undefined,
      source: 'stripe_checkout',
    });
  }, [tier]);

  // Track Purchase event when order data is loaded
  useEffect(() => {
    if (!order || !order.amount_total || !order.currency) return;

    const numItems = order.line_items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1;
    trackEvent('Purchase', {
      // Meta 標準參數
      value: order.amount_total / 100, // Convert from cents to dollars
      currency: order.currency.toUpperCase(),
      content_name: order.ticket_tier ? `${order.ticket_tier} Ticket` : 'Event Ticket',
      content_category: 'Tickets',
      content_ids: order.id ? [order.id] : undefined,
      num_items: numItems,
      // 完整訂單資訊（webhook 用途）
      order_id: order.id ?? undefined,
      customer_email: order.customer_email ?? undefined,
      customer_name: order.customer_name ?? undefined,
      ticket_tier: order.ticket_tier ?? undefined,
      payment_status: order.payment_status ?? undefined,
      payment_intent_id: order.payment_intent_id ?? undefined,
      amount_subtotal: order.amount_subtotal != null ? order.amount_subtotal / 100 : undefined,
      amount_discount: order.amount_discount != null ? order.amount_discount / 100 : undefined,
    });
  }, [order]);

  useEffect(() => {
    if (!sessionId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/checkout/session?id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) {
          throw new Error(await res.text());
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

        // 同步更新 Supabase 订单状态
        if (orderData.payment_status === 'paid') {
          try {
            await fetch('/api/order/sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                session_id: sessionId,
              }),
            });
          } catch (syncErr) {
            console.error('Failed to sync order status', syncErr);
            // Don't show error to user, sync failure is not critical for display
          }
        }

        // 備援寄信：主要由 Stripe webhook 觸發，但 webhook 可能延遲或遺失。
        // 冪等檢查確保不會重複寄信。
        if (orderData.customer_email && orderData.payment_status === 'paid') {
          fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: orderData, type: 'success' }),
          }).catch(() => {});
        }
      } catch (err) {
        console.error('Failed to load order details', err);
        setError(t.checkout?.orderError ?? 'Unable to load order details.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [sessionId, t.checkout]);

  const tierLabel =
    (tier && t.tickets?.[tier as 'explore' | 'contribute' | 'weekly_backer' | 'backer']?.label) || '';

  return (
    <main className="min-h-screen bg-[#1E1F1C] text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-400/40 mb-2">
          <span className="text-3xl">✅</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">
          {t.checkout?.successTitle ?? 'Payment Successful'}
        </h1>
        <p className="text-white/80 text-sm md:text-base leading-relaxed">
          {t.checkout?.successDescription ??
            'Your payment was successful. We have sent a confirmation email to your inbox.'}
        </p>
        {tier && (
          <p className="text-white/90 text-sm md:text-base">
            {t.checkout?.ticketInfoPrefix ?? 'Your ticket type:'}{' '}
            <span className="font-semibold text-[#10B8D9]">
              {tierLabel || tier.toUpperCase()}
            </span>
          </p>
        )}

        {/* Order details */}
        <div className="mt-4 text-left bg-white/5 border border-white/10 rounded-xl p-4 space-y-4 text-sm">
          <p className="font-semibold text-white text-base mb-3">
            {t.checkout?.orderSummaryTitle ?? 'Order summary'}
          </p>
          {loading && (
            <p className="text-white/70">
              {t.checkout?.orderLoading ?? 'Loading your order details...'}
            </p>
          )}
          {error && !loading && (
            <p className="text-red-400">
              {error}
            </p>
          )}
          {order && !loading && !error && (
            <div className="space-y-4">
              {/* Payment Status */}
              {order.payment_status && (
                <div className="pb-2 border-b border-white/10">
                  <p className="text-white/70 text-xs uppercase tracking-wide">
                    {t.checkout?.orderStatusLabel ?? 'Payment status'}
                  </p>
                  <p className="text-emerald-400 font-semibold mt-1">
                    {order.payment_status === 'paid' ? '✓ Paid' : order.payment_status}
                  </p>
                </div>
              )}

              {/* Line Items */}
              {order.line_items && order.line_items.length > 0 && (
                <div>
                  <p className="text-white/70 text-xs uppercase tracking-wide mb-2">
                    {t.checkout?.orderItemsLabel ?? 'Items'}
                  </p>
                  <div className="space-y-2">
                    {order.line_items.map((item, idx) => (
                      <div key={item.id || idx} className="bg-white/5 rounded-lg p-3">
                        <p className="text-white font-medium">
                          {item.product_name || item.description || `${t.checkout?.orderItemPrefix || 'Item'} ${idx + 1}`}
                        </p>
                        {item.product_description && (
                          <p className="text-white/60 text-xs mt-1">{item.product_description}</p>
                        )}
                        <div className="flex justify-between items-center mt-2 text-xs">
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
              <div className="pt-2 border-t border-white/10 space-y-2">
                {order.amount_subtotal != null && order.currency && (
                  <div className="flex justify-between text-white/80">
                    <span>{t.checkout?.orderSubtotalLabel ?? 'Subtotal'}:</span>
                    <span>{(order.amount_subtotal / 100).toFixed(2)} {order.currency.toUpperCase()}</span>
                  </div>
                )}
                {order.amount_discount != null && order.amount_discount > 0 && order.currency && (
                  <div className="flex justify-between text-emerald-400">
                    <span>{t.checkout?.orderDiscountLabel ?? 'Discount'}:</span>
                    <span>-{(order.amount_discount / 100).toFixed(2)} {order.currency.toUpperCase()}</span>
                  </div>
                )}
                {order.amount_tax != null && order.amount_tax > 0 && order.currency && (
                  <div className="flex justify-between text-white/80">
                    <span>{t.checkout?.orderTaxLabel ?? 'Tax'}:</span>
                    <span>{(order.amount_tax / 100).toFixed(2)} {order.currency.toUpperCase()}</span>
                  </div>
                )}
                {order.amount_total != null && order.currency && (
                  <div className="flex justify-between text-white font-bold text-base pt-2 border-t border-white/10">
                    <span>{t.checkout?.orderAmountLabel ?? 'Total amount'}:</span>
                    <span>{(order.amount_total / 100).toFixed(2)} {order.currency.toUpperCase()}</span>
                  </div>
                )}
              </div>

              {/* Customer Information */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                {order.customer_email && (
                  <p className="text-white/80">
                    <span className="text-white/60">{t.checkout?.orderEmailLabel ?? 'Confirmation sent to'}:</span>{' '}
                    <span className="font-mono break-all">{order.customer_email}</span>
                  </p>
                )}
                {order.customer_name && (
                  <p className="text-white/80">
                    <span className="text-white/60">{t.checkout?.orderNameLabel ?? 'Customer name'}:</span>{' '}
                    <span>{order.customer_name}</span>
                  </p>
                )}
                {order.customer_phone && (
                  <p className="text-white/80">
                    <span className="text-white/60">{t.checkout?.orderPhoneLabel ?? 'Phone'}:</span>{' '}
                    <span>{order.customer_phone}</span>
                  </p>
                )}
                {order.customer_address && (
                  <div className="text-white/80">
                    <span className="text-white/60">{t.checkout?.orderAddressLabel ?? 'Billing address'}:</span>
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
                      {order.customer_address.country && <div>{order.customer_address.country}</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              {order.payment_method_last4 && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-white/70">
                    {t.checkout?.orderCardLabel ?? 'Paid with card ending in'}{' '}
                    <span className="font-mono">**** {order.payment_method_last4}</span>
                    {order.payment_method_brand && ` (${order.payment_method_brand})`}
                  </p>
                </div>
              )}

              {/* Order Time */}
              {order.created && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-white/70 text-xs">
                    {t.checkout?.orderTimeLabel ?? 'Order time'}:{' '}
                    {new Date(order.created * 1000).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Order IDs */}
              <div className="pt-2 border-t border-white/10 space-y-1">
                <p className="text-white/60 text-xs">
                  {t.checkout?.orderIdLabel ?? 'Order ID'}:{' '}
                  <span className="font-mono break-all">{order.id}</span>
                </p>
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
        </div>

        <div className="pt-4">
          <button
            onClick={() => router.push('/')}
            className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {t.checkout?.backToHome ?? 'Back to homepage'}
          </button>
        </div>
      </div>
    </main>
  );
}

