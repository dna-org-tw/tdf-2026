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

type Section = {
  title: string;
  paragraphs?: string[];
  items?: string[];
  afterItems?: string[];
};

export default function PrivacyPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const p = t.privacy;

  useEffect(() => {
    trackEvent('ViewContent', {
      content_name: 'Privacy Policy Page',
      content_category: 'Legal',
    });
  }, []);

  const sections = (p?.sections ?? []) as Section[];

  return (
    <main className="min-h-screen bg-[#1E1F1C] text-white">
      <Navbar />
      <article className="container mx-auto px-4 sm:px-6 pt-24 pb-12 max-w-3xl">
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {p?.title ?? 'Privacy Policy'}
          </h1>
          <p className="text-white/60 text-sm">
            {p?.lastUpdated ?? 'Last updated: April 2026'}
          </p>
        </header>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          {p?.intro && (
            <p className="text-white/90 leading-relaxed">{p.intro}</p>
          )}

          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-xl font-semibold text-white mb-4">{s.title}</h2>
              {s.paragraphs?.map((para, j) => (
                <p key={`p-${j}`} className="text-white/90 leading-relaxed mb-3">
                  {para}
                </p>
              ))}
              {s.items && s.items.length > 0 && (
                <ul className="list-disc pl-5 space-y-1 text-white/90">
                  {s.items.map((item, j) => (
                    <li key={`i-${j}`}>{item}</li>
                  ))}
                </ul>
              )}
              {s.afterItems?.map((para, j) => (
                <p key={`a-${j}`} className="text-white/90 leading-relaxed mt-3">
                  {para}
                </p>
              ))}
            </section>
          ))}

          {p?.contactEmail && (
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                {p?.contactTitle ?? 'Contact'}
              </h2>
              <p className="text-white/90 leading-relaxed">
                {p.contactBody}{' '}
                <a
                  href={`mailto:${p.contactEmail}`}
                  className="text-[#10B8D9] hover:underline"
                  onClick={() => {
                    trackEvent('Contact', {
                      content_category: 'Privacy Policy',
                      location: 'privacy-page',
                    });
                  }}
                >
                  {p.contactEmail}
                </a>
              </p>
            </section>
          )}
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-white/70 hover:text-white text-sm underline"
          >
            {p?.backToHome ?? 'Back to homepage'}
          </button>
        </div>
      </article>
      <Footer />
    </main>
  );
}
