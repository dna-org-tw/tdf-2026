'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent, trackCustomEvent } from '@/components/FacebookPixel';

export default function OrderQueryPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

  // 提交订单查询的函数
  const submitOrderQuery = useCallback(async (token: string) => {
    if (!orderId.trim()) {
      setError(t.orderQuery?.orderIdRequired ?? 'Please enter an order ID.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/order/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderId.trim(),
          recaptchaToken: token,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || (t.orderQuery?.queryError ?? 'Failed to query order.'));
      }

      // Redirect to order detail page
      router.push(`/order/${data.id}`);
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
  }, [orderId, t, router]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orderId.trim()) {
      setError(t.orderQuery?.orderIdRequired ?? 'Please enter an order ID.');
      return;
    }

    // Track search event
    trackEvent('Search', {
      search_string: orderId.trim(),
      content_category: 'Order Query',
    });
    trackCustomEvent('OrderQuerySearch', {
      order_id: orderId.trim(),
    });

    // 如果有 reCAPTCHA，使用 grecaptcha.enterprise.execute() 获取 token
    if (recaptchaSiteKey) {
      try {
        // 检查 grecaptcha 是否已加载
        if (typeof window !== 'undefined' && window.grecaptcha?.enterprise) {
          const token = await window.grecaptcha.enterprise.execute(recaptchaSiteKey, { action: 'submit' });
          submitOrderQuery(token);
        } else {
          setError(t.orderQuery?.recaptchaError ?? 'reCAPTCHA is not loaded. Please refresh the page.');
        }
      } catch (err) {
        console.error('reCAPTCHA execution failed:', err);
        setError(t.orderQuery?.recaptchaError ?? 'reCAPTCHA verification failed. Please try again.');
      }
    } else {
      // 如果没有配置 reCAPTCHA，直接提交
      submitOrderQuery('');
    }
  };

  return (
    <main className="min-h-screen bg-[#1E1F1C] text-white flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {t.orderQuery?.title ?? 'Order Query'}
          </h1>
          <p className="text-white/70 text-sm md:text-base">
            {t.orderQuery?.description ??
              'Enter your order ID to view your order details and payment status.'}
          </p>
        </div>

        <form ref={formRef} id="order-query-form" onSubmit={handleFormSubmit} className="space-y-6">
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
    </main>
  );
}
