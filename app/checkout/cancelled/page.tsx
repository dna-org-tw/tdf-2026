'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent } from '@/components/FacebookPixel';

export default function CheckoutCancelledPage() {
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
      content_name: 'Checkout Cancelled',
      content_category: 'Checkout',
      tier: tier || undefined,
      source: 'stripe_checkout',
    });
  }, [tier]);

  return (
    <main className="min-h-screen bg-[#1E1F1C] text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-400/40 mb-2">
          <span className="text-3xl">&#x26A0;&#xFE0F;</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">
          {t.checkout?.cancelledTitle ?? 'Payment Cancelled'}
        </h1>
        <p className="text-white/80 text-sm md:text-base leading-relaxed">
          {t.checkout?.cancelledDescription ??
            'Payment cancelled. You can try again if needed.'}
        </p>

        <div className="pt-4 space-y-3">
          <button
            onClick={() => router.push('/?scroll=tickets')}
            className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {t.checkout?.tryAgain ?? 'Go back and try again'}
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
