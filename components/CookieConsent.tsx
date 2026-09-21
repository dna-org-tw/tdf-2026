'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { useCookieConsent, writeCookieConsent } from '@/lib/cookieConsent';

export default function CookieConsent() {
  const { t } = useTranslation();
  const banner = t.cookieBanner;
  const state = useCookieConsent();

  if (state !== 'unknown') return null;

  return (
    <div
      role="dialog"
      aria-label={banner?.ariaLabel ?? 'Cookie consent'}
      className="fixed inset-x-0 bottom-0 z-[9999] px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="mx-auto max-w-3xl rounded-xl bg-[#1E1F1C] text-white shadow-2xl border border-white/10 px-5 py-4 sm:px-6 sm:py-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex-1 text-sm leading-relaxed">
          <p className="text-white/90">
            {banner?.message ??
              'We use essential cookies to run this site. With your consent we also use analytics (Google) and marketing (Meta) cookies to measure and improve the festival.'}
            {' '}
            <Link href="/privacy" className="text-[#10B8D9] hover:underline">
              {banner?.learnMore ?? 'Learn more'}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => writeCookieConsent('rejected')}
            className="px-4 py-2 text-sm rounded-lg border border-white/20 text-white/80 hover:bg-white/5 transition-colors"
          >
            {banner?.reject ?? 'Reject'}
          </button>
          <button
            type="button"
            onClick={() => writeCookieConsent('accepted')}
            className="px-4 py-2 text-sm rounded-lg bg-[#10B8D9] text-white font-semibold hover:bg-[#0EA5C4] transition-colors"
          >
            {banner?.accept ?? 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
