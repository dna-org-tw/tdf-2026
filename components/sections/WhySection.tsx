'use client';

import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';

export default function WhySection() {
  const { t } = useTranslation();

  const taitungContent = (t.why as any).taitung;
  const hualienContent = (t.why as any).hualien;

  const reasons = (t.why as any).reasons || [];

  return (
    <section id="why" className="bg-white py-24 md:py-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="text-4xl font-display font-bold text-[#1E1F1C] mb-8">{t.nav.why}</h2>
          {reasons.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="max-w-5xl mx-auto"
            >
              <div className="grid grid-cols-3 md:flex md:flex-row md:justify-center gap-4 md:gap-6">
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
                      className="flex flex-col items-center text-center gap-2"
                    >
                      <span className="text-3xl mb-1">{reasonObj.icon}</span>
                      <span className="text-sm font-medium text-[#1E1F1C]/90 leading-tight">
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
          className="mb-12 -mx-6 md:-mx-6"
        >
          <div className="grid md:grid-cols-2 gap-4 md:gap-8">
            <div>
              <div className="relative aspect-video overflow-hidden mb-6">
                <iframe
                  src="https://www.youtube.com/embed/i7WnQn7c5bc"
                  title="YouTube video player"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
              <h3 className="text-2xl font-bold text-[#1E1F1C] mb-3">{taitungContent.title}</h3>
              <p className="text-[#1E1F1C]/80 leading-relaxed">{taitungContent.desc}</p>
            </div>
            <div>
              <div className="relative aspect-video overflow-hidden mb-6">
                <iframe
                  src="https://www.youtube.com/embed/U40EpRW5p-c"
                  title="YouTube video player"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
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
        </motion.div>
      </div>
    </section>
  );
}
