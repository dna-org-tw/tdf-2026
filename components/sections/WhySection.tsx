'use client';

import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import LazyYouTubeEmbed from '@/components/LazyYouTubeEmbed';

export default function WhySection() {
  const { t } = useTranslation();

  const taitungContent = (t.why as any).taitung;
  const hualienContent = (t.why as any).hualien;

  const reasons = (t.why as any).reasons || [];

  return (
    <section id="why" className="bg-white py-20 md:py-28 lg:py-32 transition-colors duration-500">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[#1E1F1C] mb-10 md:mb-12 lg:mb-16">{t.nav.why}</h2>
          {reasons.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="w-full"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8 lg:gap-10 mb-12">
                {reasons.map((reason: { icon: string; text: string } | string, index: number) => {
                  const reasonObj = typeof reason === 'string' 
                    ? { icon: reason.split(' ')[0], text: reason.split(' ').slice(1).join(' ') }
                    : reason;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                      className="flex flex-col items-center text-center gap-4 md:gap-5 p-6 md:p-8"
                    >
                      <span className="text-6xl md:text-7xl lg:text-8xl mb-2">{reasonObj.icon}</span>
                      <span className="text-base md:text-lg lg:text-xl font-semibold text-[#1E1F1C] leading-tight">
                        {reasonObj.text}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 -mx-4 sm:-mx-6 md:-mx-6"
        >
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 lg:gap-10">
            <div>
              <div className="mb-6">
                <LazyYouTubeEmbed
                  videoId="i7WnQn7c5bc"
                  title={taitungContent.title}
                />
              </div>
              <h3 className="text-2xl font-bold text-[#1E1F1C] mb-3">{taitungContent.title}</h3>
              <p className="text-[#1E1F1C]/80 leading-relaxed">{taitungContent.desc}</p>
            </div>
            <div>
              <div className="mb-6">
                <LazyYouTubeEmbed
                  videoId="U40EpRW5p-c"
                  title={hualienContent.title}
                />
              </div>
              <h3 className="text-2xl font-bold text-[#1E1F1C] mb-3">{hualienContent.title}</h3>
              <p className="text-[#1E1F1C]/80 leading-relaxed">{hualienContent.desc}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center flex flex-wrap justify-center gap-4"
        >
          {t.why.ctas?.map((cta) => {
            const isPrimary = cta.type === "Register";
            return (
              <motion.a
                key={cta.type}
                href={cta.href}
                target={cta.href.startsWith('http') ? '_blank' : undefined}
                rel={cta.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`inline-block px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 rounded-full text-sm sm:text-base md:text-lg font-bold tracking-wide transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 ${
                  isPrimary
                    ? 'bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white shadow-[#10B8D9]/30 hover:shadow-[#10B8D9]/50'
                    : 'bg-white hover:bg-stone-50 text-[#1E1F1C] border-2 border-[#1E1F1C] hover:border-[#10B8D9]'
                }`}
              >
                {cta.text}
              </motion.a>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
