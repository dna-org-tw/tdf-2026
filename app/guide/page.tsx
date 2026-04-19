'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent } from '@/components/FacebookPixel';
import { guideContent } from '@/data/guide';
import GuideHero from '@/components/guide/GuideHero';
import GuideSearch from '@/components/guide/GuideSearch';
import GuideQuickNav from '@/components/guide/GuideQuickNav';
import GuideSectionRenderer from '@/components/guide/GuideSectionRenderer';
import GuideLimitationsSection from '@/components/guide/GuideLimitationsSection';
import GuideContactCard from '@/components/guide/GuideContactCard';

const Footer = dynamic(() => import('@/components/Footer'), {
  ssr: false,
  loading: () => null,
});

function scrollToHash(hash: string) {
  const id = hash.replace(/^#/, '');
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function GuidePage() {
  const { lang } = useTranslation();
  const guide = lang === 'en' ? guideContent.en : guideContent.zh;

  useEffect(() => {
    trackEvent('ViewContent', {
      content_name: 'Guide Page',
      content_category: 'Information',
    });
  }, []);

  useEffect(() => {
    const syncHash = () => {
      if (!window.location.hash) return;
      window.setTimeout(() => scrollToHash(window.location.hash), 80);
    };

    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [lang]);

  return (
    <main className="min-h-screen bg-white text-[#1E1F1C]">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 pt-28 pb-16">
        <div className="mx-auto max-w-6xl space-y-8">
          <GuideHero guide={guide} />
          <div
            style={{ top: '5rem' }}
            className="sticky z-30 -mx-4 space-y-3 bg-white/95 px-4 pt-3 pb-0 backdrop-blur sm:-mx-6 sm:px-6"
          >
            <GuideSearch sections={guide.sections} lang={lang} />
            <GuideQuickNav navGroups={guide.navGroups} />
          </div>
          {guide.sections.map((section) => (
            <GuideSectionRenderer key={section.id} section={section} />
          ))}
          <GuideLimitationsSection limitations={guide.limitations} />
          <GuideContactCard lang={lang} />
        </div>
      </div>
      <Footer />
    </main>
  );
}
