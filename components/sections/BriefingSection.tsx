'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Star } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { trackCustomEvent } from '@/components/FacebookPixel';
import BriefingModal from '@/components/BriefingModal';
import Script from 'next/script';

export default function BriefingSection() {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const dismissedDate = localStorage.getItem('briefing-modal-dismissed');
    const today = new Date().toISOString().slice(0, 10);
    if (dismissedDate !== today) {
      setModalOpen(true);
    }
  }, []);

  const handleClose = () => {
    setModalOpen(false);
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('briefing-modal-dismissed', today);
  };

  return (
    <>
      <section className="relative bg-gradient-to-b from-[#0a1628] to-[#1E1F1C] py-12 sm:py-16 overflow-hidden">
        {/* Accent glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[2px] bg-gradient-to-r from-transparent via-[#10B8D9]/60 to-transparent" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 sm:p-8 md:p-10 backdrop-blur-sm"
          >
            {/* Badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 bg-[#10B8D9]/15 text-[#10B8D9] text-xs font-semibold px-3 py-1 rounded-full border border-[#10B8D9]/30">
                <Calendar className="w-3.5 h-3.5" />
                {t.briefing.badge}
              </span>
            </div>

            {/* Title & Description */}
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-white mb-3">
              {t.briefing.title}
            </h2>
            <p className="text-white/70 text-base sm:text-lg mb-6 max-w-2xl">
              {t.briefing.description}
            </p>

            {/* Highlights */}
            <ul className="space-y-2.5 mb-6">
              {t.briefing.highlights.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5 text-white/80 text-sm sm:text-base">
                  <CheckCircle2 className="w-4.5 h-4.5 text-[#10B8D9] mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            {/* Guest callout */}
            <div className="flex items-start gap-2.5 bg-[#10B8D9]/10 border border-[#10B8D9]/20 rounded-xl px-4 py-3 mb-8">
              <Star className="w-4.5 h-4.5 text-[#10B8D9] mt-0.5 flex-shrink-0" />
              <p className="text-white/90 text-sm sm:text-base font-medium">
                {t.briefing.guest}
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://luma.com/event/evt-1ZQ0H7LPHB2tovg"
                className="luma-checkout--button inline-flex items-center justify-center bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white font-bold text-base px-8 py-3.5 rounded-xl shadow-lg shadow-[#10B8D9]/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                data-luma-action="checkout"
                data-luma-event-id="evt-1ZQ0H7LPHB2tovg"
                onClick={() => {
                  trackCustomEvent('BriefingRegisterClick', {
                    location: 'briefing_section',
                    action: 'luma_checkout',
                  });
                }}
              >
                {t.briefing.registerButton}
              </a>
              <a
                href="https://luma.com/event/evt-1ZQ0H7LPHB2tovg"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackCustomEvent('BriefingDetailsClick', {
                    location: 'briefing_section',
                    action: 'view_details',
                  });
                }}
                className="inline-flex items-center justify-center bg-white/10 hover:bg-white/15 text-white border border-white/20 font-semibold text-base px-8 py-3.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {t.briefing.detailsButton}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Luma Checkout Script */}
      <Script
        id="luma-checkout"
        src="https://embed.lu.ma/checkout-button.js"
        strategy="lazyOnload"
      />

      {/* Briefing Modal */}
      <BriefingModal
        isOpen={modalOpen}
        onClose={handleClose}
      />
    </>
  );
}
