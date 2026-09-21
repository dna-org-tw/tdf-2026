'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent } from '@/components/FacebookPixel';

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();

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

  useEffect(() => {
    trackEvent('Purchase', {
      content_name: tier ? `${tier} Ticket` : 'Event Ticket',
      content_category: 'Tickets',
      ticket_tier: tier || undefined,
    });
  }, [tier]);

  const tierLabel =
    (tier && t.tickets?.[tier as 'explore' | 'contribute' | 'weekly_backer' | 'backer']?.label) || '';

  return (
    <main className="min-h-screen bg-[#1E1F1C] text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-400/40 mb-2">
          <span className="text-3xl">&#x2705;</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">
          {t.checkout?.successTitle ?? 'Payment Successful'}
        </h1>
        <p className="text-white/80 text-sm md:text-base leading-relaxed">
          {t.checkout?.successDescription ??
            'Payment successful! Please log in on the order page to view your order details.'}
        </p>
        {tier && (
          <p className="text-white/90 text-sm md:text-base">
            {t.checkout?.ticketInfoPrefix ?? 'Your ticket type:'}{' '}
            <span className="font-semibold text-[#10B8D9]">
              {tierLabel || tier.toUpperCase()}
            </span>
          </p>
        )}

        <div className="pt-4 space-y-3">
          <button
            onClick={() => router.push('/order/query')}
            className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {'View My Orders'}
          </button>
          <br className="hidden md:block" />
          <button
            onClick={() => router.push('/')}
            className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all duration-200"
          >
            {t.checkout?.backToHome ?? 'Back to homepage'}
          </button>
        </div>
      </div>
    </main>
  );
}
