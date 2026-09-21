'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { guideContent } from '@/data/guide';
import { useSectionTracking } from '@/hooks/useSectionTracking';

export default function FAQSection() {
  const { lang } = useTranslation();
  const guide = lang === 'en' ? guideContent.en : guideContent.zh;
  useSectionTracking({ sectionId: 'faq', sectionName: 'FAQ Section', category: 'Information' });

  return (
    <section id="faq" className="bg-stone-50 py-20 md:py-28 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12"
        >
          {guide.homeFaqTitle}
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {guide.homeFaq.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Link
                href={`/guide#${item.guideSection}`}
                className="block p-5 bg-white rounded-xl border border-stone-200 hover:border-stone-300 hover:shadow-sm transition-all h-full"
              >
                <h3 className="font-semibold text-[#1E1F1C] mb-2">{item.question}</h3>
                <p className="text-sm text-stone-500">{item.summary}</p>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <Link
            href="/guide"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1E1F1C] text-white rounded-full font-medium hover:bg-[#2a2b28] transition-colors"
          >
            {guide.homeFaqCta}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
