'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent } from '@/components/FacebookPixel';
import Navbar from '@/components/Navbar';

const Footer = dynamic(() => import('@/components/Footer'), {
  ssr: false,
  loading: () => null,
});

export default function CodeOfConductPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const coc = t.codeOfConduct;

  useEffect(() => {
    trackEvent('ViewContent', {
      content_name: 'Code of Conduct Page',
      content_category: 'Legal',
    });
  }, []);

  return (
    <main className="min-h-screen bg-[#1E1F1C] text-white">
      <Navbar />
      <article className="container mx-auto px-4 sm:px-6 pt-24 pb-12 max-w-3xl">
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {coc?.title ?? 'Code of Conduct'}
          </h1>
          <p className="text-white/60 text-sm">
            {coc?.lastUpdated ?? 'Last updated: February 2026'}
          </p>
        </header>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <p className="text-white/90 leading-relaxed">
            {coc?.intro}
          </p>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              {coc?.quickVersion?.title ?? 'The Quick Version'}
            </h2>
            <p className="text-white/90 leading-relaxed">
              {coc?.quickVersion?.content}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              {coc?.fullVersion?.title ?? 'The Full Version'}
            </h2>

            <div className="space-y-6 text-white/90">
              <div>
                <h3 className="text-base font-medium text-white mb-2">
                  {coc?.fullVersion?.harassment?.title}
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  {(coc?.fullVersion?.harassment?.items ?? []).map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-base font-medium text-white mb-2">
                  {coc?.fullVersion?.expected?.title}
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  {(coc?.fullVersion?.expected?.items ?? []).map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <p>{coc?.fullVersion?.sponsors}</p>

              <p>{coc?.fullVersion?.enforcement}</p>

              <div>
                <h3 className="text-base font-medium text-white mb-2">
                  {coc?.fullVersion?.reporting?.title}
                </h3>
                <p className="mb-2">{coc?.fullVersion?.reporting?.content}</p>
                <p>
                  {coc?.fullVersion?.reporting?.email}{' '}
                  <a
                    href="mailto:fest@dna.org.tw"
                    className="text-[#10B8D9] hover:underline"
                    onClick={() => {
                      trackEvent('Contact', { content_category: 'Code of Conduct', location: 'code-of-conduct-page' });
                    }}
                  >
                    fest@dna.org.tw
                  </a>
                </p>
              </div>

              <p>{coc?.fullVersion?.scope}</p>

              <p>{coc?.fullVersion?.contact}</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-white/70 hover:text-white text-sm underline"
          >
            {coc?.backToHome ?? 'Back to homepage'}
          </button>
        </div>
      </article>
      <Footer />
    </main>
  );
}
