'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent } from '@/components/FacebookPixel';
import Navbar from '@/components/Navbar';

const Footer = dynamic(() => import('@/components/Footer'), {
  ssr: false,
  loading: () => null,
});

type QueryMode = 'orderId' | 'email';

interface OrderSummary {
  id: string;
  status: string;
  payment_status: string;
  amount_total: number;
  currency: string;
  created: number;
  customer_name: string | null;
  ticket_tier: string | null;
  product_name: string | null;
}

export default function OrderQueryPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [queryMode, setQueryMode] = useState<QueryMode>('orderId');
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

  const submitOrderQuery = useCallback(async (token: string) => {
    const isEmailMode = queryMode === 'email';
    const queryValue = isEmailMode ? email.trim() : orderId.trim();

    if (!queryValue) {
      setError(
        isEmailMode
          ? (t.orderQuery?.emailRequired ?? 'Please enter an email address.')
          : (t.orderQuery?.orderIdRequired ?? 'Please enter an order ID.')
      );
      return;
    }

    setLoading(true);
    setError(null);
    setOrders(null);

    try {
      const payload: Record<string, string> = { recaptchaToken: token };
      if (isEmailMode) {
        payload.email = queryValue;
      } else {
        payload.orderId = queryValue;
      }

      const res = await fetch('/api/order/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || (t.orderQuery?.queryError ?? 'Failed to query order.'));
      }

      if (isEmailMode && data.orders) {
        setOrders(data.orders);
      } else {
        router.push(`/order/${data.id}`);
      }
    } catch (err) {
      console.error('Failed to query order', err);
      setError(
        err instanceof Error
          ? err.message
          : t.orderQuery?.queryError ?? 'Failed to query order. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [queryMode, orderId, email, t, router]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isEmailMode = queryMode === 'email';
    const queryValue = isEmailMode ? email.trim() : orderId.trim();

    if (!queryValue) {
      setError(
        isEmailMode
          ? (t.orderQuery?.emailRequired ?? 'Please enter an email address.')
          : (t.orderQuery?.orderIdRequired ?? 'Please enter an order ID.')
      );
      return;
    }

    trackEvent('Search', {
      search_string: queryValue,
      content_category: 'Order Query',
      ...(isEmailMode ? { email: queryValue } : { order_id: queryValue }),
    });

    if (recaptchaSiteKey) {
      try {
        if (typeof window !== 'undefined' && window.grecaptcha?.enterprise) {
          const token = await window.grecaptcha.enterprise.execute(recaptchaSiteKey, { action: 'submit' });
          submitOrderQuery(token);
        } else {
          setError(t.orderQuery?.recaptchaNotLoaded ?? t.orderQuery?.recaptchaError ?? 'reCAPTCHA is not loaded. Please refresh the page.');
        }
      } catch (err) {
        console.error('reCAPTCHA execution failed:', err);
        setError(t.orderQuery?.recaptchaError ?? 'reCAPTCHA verification failed. Please try again.');
      }
    } else {
      submitOrderQuery('');
    }
  };

  const handleTabSwitch = (mode: QueryMode) => {
    setQueryMode(mode);
    setError(null);
    setOrders(null);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp * 1000));
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return t.orderQuery?.statusPaid ?? 'Paid';
      case 'unpaid':
        return t.orderQuery?.statusUnpaid ?? 'Unpaid';
      case 'no_payment_required':
        return t.orderQuery?.statusNoPaymentRequired ?? 'No Payment Required';
      default:
        return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'unpaid':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      default:
        return 'text-white/60 bg-white/5 border-white/20';
    }
  };

  useEffect(() => {
    trackEvent('ViewContent', {
      content_name: 'Order Query Page',
      content_category: 'Order',
    });
  }, []);

  if (orders) {
    return (
      <main className="min-h-screen flex flex-col bg-[#1E1F1C] text-white">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4 py-12 pt-24">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                {t.orderQuery?.resultsTitle ?? 'Orders Found'}
              </h1>
              <p className="text-white/70 text-sm md:text-base">
                {t.orderQuery?.resultsDescription ?? 'Select an order to view its details.'}
              </p>
            </div>

            <div className="space-y-4">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => router.push(`/order/${order.id}`)}
                  className="w-full text-left p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white group-hover:text-[#10B8D9] transition-colors truncate">
                        {order.product_name || order.ticket_tier || order.id}
                      </p>
                      <p className="text-sm text-white/50 mt-1">
                        {formatDate(order.created)}
                      </p>
                      {order.customer_name && (
                        <p className="text-sm text-white/50 mt-0.5">
                          {order.customer_name}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="font-semibold text-white">
                        {formatCurrency(order.amount_total, order.currency)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getPaymentStatusColor(order.payment_status)}`}>
                        {getPaymentStatusLabel(order.payment_status)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="text-center mt-8">
              <button
                type="button"
                onClick={() => setOrders(null)}
                className="text-white/70 hover:text-white text-sm underline"
              >
                {t.orderQuery?.backToSearch ?? 'Back to search'}
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-[#1E1F1C] text-white">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-12 pt-24">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {t.orderQuery?.title ?? 'Order Query'}
          </h1>
          <p className="text-white/70 text-sm md:text-base">
            {t.orderQuery?.description ??
              'Enter your order ID or email to view your order details and payment status.'}
          </p>
        </div>

        <div className="flex rounded-lg bg-white/5 p-1 mb-6">
          <button
            type="button"
            onClick={() => handleTabSwitch('orderId')}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              queryMode === 'orderId'
                ? 'bg-[#10B8D9] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {t.orderQuery?.tabOrderId ?? 'Order ID'}
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('email')}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              queryMode === 'email'
                ? 'bg-[#10B8D9] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {t.orderQuery?.tabEmail ?? 'Email'}
          </button>
        </div>

        <form ref={formRef} id="order-query-form" onSubmit={handleFormSubmit} className="space-y-6">
          {queryMode === 'orderId' ? (
            <div>
              <label
                htmlFor="orderId"
                className="block text-sm font-medium text-white/90 mb-2"
              >
                {t.orderQuery?.orderIdLabel ?? 'Order ID'}
              </label>
              <input
                id="orderId"
                type="text"
                value={orderId}
                onChange={(e) => {
                  setOrderId(e.target.value);
                  setError(null);
                }}
                placeholder={t.orderQuery?.orderIdPlaceholder ?? 'Enter your order ID'}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent"
                disabled={loading}
              />
              <p className="mt-2 text-xs text-white/60">
                {t.orderQuery?.orderIdHint ??
                  'You can find your order ID in the confirmation email or on the payment page.'}
              </p>
            </div>
          ) : (
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-white/90 mb-2"
              >
                {t.orderQuery?.emailLabel ?? 'Email'}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder={t.orderQuery?.emailPlaceholder ?? 'Enter the email used for your order'}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent"
                disabled={loading}
              />
              <p className="mt-2 text-xs text-white/60">
                {t.orderQuery?.emailHint ??
                  'Enter the email address you used when placing your order.'}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full px-6 py-3 rounded-lg font-semibold text-base bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading
              ? t.orderQuery?.querying ?? 'Querying...'
              : t.orderQuery?.queryButton ?? 'Query Order'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-white/70 hover:text-white text-sm underline"
            >
              {t.orderQuery?.backToHome ?? 'Back to homepage'}
            </button>
          </div>
        </form>
      </div>
      </div>
      <Footer />
    </main>
  );
}
