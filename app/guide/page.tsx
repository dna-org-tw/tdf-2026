'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent } from '@/components/FacebookPixel';
import Navbar from '@/components/Navbar';
import Accordion from '@/components/Accordion';
import { guideContent } from '@/data/guide';

const Footer = dynamic(() => import('@/components/Footer'), {
  ssr: false,
  loading: () => null,
});

export default function GuidePage() {
  const { lang } = useTranslation();
  const guide = lang === 'en' ? guideContent.en : guideContent.zh;
  const [activeTab, setActiveTab] = useState(guide.tabs[0].id);

  // Sync tab from URL hash on mount and hash change
  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && guide.tabs.some((tab) => tab.id === hash)) {
        setActiveTab(hash);
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [guide.tabs]);

  // Track page view
  useEffect(() => {
    trackEvent('ViewContent', {
      content_name: 'Guide Page',
      content_category: 'Information',
    });
  }, []);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    window.history.replaceState(null, '', `#${tabId}`);
  };

  const activeTabData = guide.tabs.find((tab) => tab.id === activeTab);

  return (
    <main className="min-h-screen bg-white text-[#1E1F1C]">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 pt-28 pb-16">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{guide.pageTitle}</h1>
          <p className="text-stone-500">{guide.pageDescription}</p>
        </div>

        {/* Tab bar */}
        <div className="mb-10 overflow-x-auto -mx-4 px-4 scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            {guide.tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#1E1F1C] text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="max-w-3xl mx-auto">
          {activeTabData && (
            <>
              {/* FAQ accordion items */}
              {activeTabData.faqItems.length > 0 && (
                <Accordion items={activeTabData.faqItems} />
              )}

              {/* Guide info blocks — static HTML from data/guide.ts (not user input) */}
              {activeTabData.guideBlocks.length > 0 && (
                <div className={activeTabData.faqItems.length > 0 ? 'mt-10' : ''}>
                  {activeTabData.guideBlocks.map((block, i) => (
                    <div key={i} className="mb-8">
                      <h3 className="text-xl font-semibold mb-4">{block.title}</h3>
                      <div
                        className="prose prose-stone max-w-none prose-table:w-full prose-th:text-left prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-table:border-collapse prose-th:border prose-th:border-stone-200 prose-td:border prose-td:border-stone-200 prose-th:bg-stone-50"
                        dangerouslySetInnerHTML={{ __html: block.content }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Footer />
    </main>
  );
}
