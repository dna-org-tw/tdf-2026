'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';

export default function PartnersSection() {
  const { t } = useTranslation();
  
  return (
    <section id="partners" className="text-center">
      {/* 主辦單位 Organizers */}
      <div className="py-24 md:py-32 bg-[#F6F6F6]">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-display font-bold text-[#1E1F1C] mb-12"
          >
            {t.partners.organizers.title}
          </motion.h2>
          
          <div className="flex flex-col items-center gap-12 md:gap-16 lg:gap-20 opacity-70 hover:opacity-100 transition-all duration-500">
            {/* TDNA 獨立一排 */}
            <div className="relative h-28 md:h-36 lg:h-44 w-auto">
              <Image
                src="/images/logo/tdna_logo.png"
                alt="Taiwan Digital Nomad Association"
                width={200}
                height={192}
                className="h-full w-auto object-contain"
                loading="lazy"
              />
            </div>
            {/* Taitung 和 Hualien 同一排 */}
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-16 lg:gap-20">
              <div className="relative h-28 md:h-36 lg:h-44 w-auto">
                <Image
                  src="/images/logo/taitung_gov_logo.png"
                  alt="Taitung Government"
                  width={200}
                  height={192}
                  className="h-full w-auto object-contain"
                  loading="lazy"
                />
              </div>
              <div className="relative h-28 md:h-36 lg:h-44 w-auto">
                <Image
                  src="/images/logo/hualien_gov_logo.png"
                  alt="Hualien Government"
                  width={200}
                  height={192}
                  className="h-full w-auto object-contain"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 贊助單位 Sponsors */}
      <div className="py-24 md:py-32 bg-[#F9D2E5]">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-display font-bold text-[#1E1F1C] mb-12"
          >
            {t.partners.sponsors.title}
          </motion.h2>
          
          {t.partners.sponsors.cta && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex justify-center"
            >
              <motion.a
                href={t.partners.sponsors.cta.href}
                target={t.partners.sponsors.cta.href.startsWith('http') ? '_blank' : undefined}
                rel={t.partners.sponsors.cta.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-block px-6 sm:px-10 py-3 sm:py-4 rounded-full text-base sm:text-lg font-bold tracking-wide transition-all shadow-lg bg-[#C54090] hover:bg-[#C54090]/80 text-white shadow-[#C54090]/20"
              >
                {t.partners.sponsors.cta.text}
              </motion.a>
            </motion.div>
          )}
        </div>
      </div>

      {/* 合作夥伴 Partners */}
      <div className="py-24 md:py-32 bg-[#10B8D9]">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-display font-bold text-white mb-12"
          >
            {t.partners.partners.title}
          </motion.h2>
          
          {t.partners.partners.cta && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex justify-center"
            >
              <motion.a
                href={t.partners.partners.cta.href}
                target={t.partners.partners.cta.href.startsWith('http') ? '_blank' : undefined}
                rel={t.partners.partners.cta.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-block px-6 sm:px-10 py-3 sm:py-4 rounded-full text-base sm:text-lg font-bold tracking-wide transition-all shadow-lg bg-white hover:bg-white/90 text-[#1E1F1C] shadow-[#004E9D]/20"
              >
                {t.partners.partners.cta.text}
              </motion.a>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
