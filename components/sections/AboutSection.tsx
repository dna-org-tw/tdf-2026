'use client';

import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';

export default function AboutSection() {
  const { t } = useTranslation();

  return (
    <section id="about" className="py-24 md:py-32 bg-white overflow-hidden relative">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center gap-16">

          {/* Video Side */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="w-full md:w-1/2"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster="/images/tdf2025.webp"
                aria-label="Taiwan Digital Fest 2025 - Digital nomads networking and connecting at the festival in Taipei, Taiwan"
                className="w-full h-auto object-contain"
              >
                <source src="/videos/tdf2025_short.mov" type="video/quicktime" />
                <source src="/videos/tdf2025_short.mov" type="video/mp4" />
              </video>
              <div className="absolute bottom-6 left-6 px-4 py-2 bg-[#000000]/60 backdrop-blur-sm rounded-lg text-white font-medium z-10 pointer-events-none">
                2025 - Taipei, Taiwan
              </div>
            </div>
          </motion.div>

          {/* Content Side */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full md:w-1/2"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-[#1E1F1C] mb-8 leading-tight">
              {t.about.title}
            </h2>
            
            {/* 關鍵活動資訊摘要 - AEO 優化 */}
            <div className="mb-6 p-6 bg-[#F6F6F6] rounded-xl border border-[#1E1F1C]/10">
              <h3 className="text-xl font-semibold text-[#1E1F1C] mb-4">{t.about.info.title}</h3>
              <ul className="space-y-2 text-[#1E1F1C]/80">
                <li>
                  <strong>{t.about.info.time}</strong>
                  <time dateTime="2026-05-01/2026-05-31">{t.about.info.timeValue}</time>
                </li>
                <li>
                  <strong>{t.about.info.location}</strong>{t.about.info.locationValue}
                </li>
                <li>
                  <strong>{t.about.info.theme}</strong>{t.about.info.themeValue}
                </li>
              </ul>
            </div>

            <p className="text-lg md:text-xl text-[#1E1F1C]/80 leading-relaxed mb-8 whitespace-pre-line">
              {t.about.description}
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              {t.about.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-4 py-2 bg-[#F9D2E5] text-[#C54090] rounded-full text-sm font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              {t.about.ctas?.map((cta, index) => {
                const isPrimary = cta.type === "Register";
                return (
                  <motion.a
                    key={cta.type}
                    href={cta.href}
                    target={cta.href.startsWith('http') ? '_blank' : undefined}
                    rel={cta.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`inline-block px-10 py-4 rounded-full text-lg font-bold tracking-wide transition-all shadow-lg ${
                      isPrimary
                        ? 'bg-[#10B8D9] hover:bg-[#10B8D9]/80 text-white shadow-[#004E9D]/20'
                        : 'bg-white hover:bg-stone-50 text-[#1E1F1C] border-2 border-[#1E1F1C]'
                    }`}
                  >
                    {cta.text}
                  </motion.a>
                );
              })}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
