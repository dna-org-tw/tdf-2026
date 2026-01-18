'use client';

import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';

export default function PartnersSection() {
  const { t } = useTranslation();
  
  return (
    <section id="partners" className="py-24 md:py-32 bg-white text-center">
      <div className="container mx-auto px-6">
        <h2 className="text-4xl md:text-5xl font-display font-bold text-[#10B8D9] mb-16">
          {t.partners.title}
        </h2>
        
        <div className="flex flex-wrap justify-center items-center gap-16 md:gap-24 opacity-70 hover:opacity-100 transition-all duration-500 mb-12">
           {/* Government partner logos */}
           <img
             src="/images/logo/taitung_gov_logo.png"
             alt="Taitung Government"
             className="h-32 md:h-40 lg:h-48 object-contain"
           />
           <img
             src="/images/logo/hualien_gov_logo.png"
             alt="Hualien Government"
             className="h-32 md:h-40 lg:h-48 object-contain"
           />
        </div>

        {/* CTA Buttons */}
        {t.partners.ctas && t.partners.ctas.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-wrap justify-center gap-4"
          >
            {t.partners.ctas.map((cta) => {
              const isPrimary = cta.type === "Call for Sponsors";
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
        )}
      </div>
    </section>
  );
}
