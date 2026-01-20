'use client';

import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import LazyVideo from '@/components/LazyVideo';

export default function WhySection() {
  const { t } = useTranslation();

  const features: Array<{
    key: string;
    video?: string;
    img?: string;
    tag: string;
  }> = [
    {
      key: 'taiwan',
      video: '/videos/taiwan_view.mp4', // Taitung Nature
      tag: 'Digital Nomad Hub'
    },
    {
      key: 'taitung',
      video: '/videos/taitung_view.mp4', // Taitung Nature
      tag: 'Nature & Culture'
    },
    {
      key: 'hualien',
      video: '/videos/hualien_view.mp4', // Taitung Nature
      tag: 'Community & Travel'
    }
  ];

  return (
    <section id="why" className="bg-white py-24 md:py-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="text-4xl font-display font-bold text-[#1E1F1C]">{t.nav.why}</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {features.map((item, index) => {
            // @ts-expect-error - item.key is a valid key of t.why but TypeScript can't infer it
            const content = t.why[item.key];
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl mb-6">
                  {item.video ? (
                    <LazyVideo
                      src={item.video}
                      poster={`${item.video.replace('.mp4', '_poster.webp')}`}
                      aria-label={`${content.title} - ${content.desc}`}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : item.img ? (
                    <img
                      src={item.img}
                      alt={content.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy" // 非首屏圖片延遲載入
                    />
                  ) : null}
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full text-[#004E9D]">
                    {item.tag}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-[#1E1F1C] mb-3">{content.title}</h3>
                <p className="text-[#1E1F1C]/80 leading-relaxed">{content.desc}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 -mx-6 md:-mx-6"
        >
          <div className="grid md:grid-cols-2 gap-4 md:gap-8">
            <div className="relative aspect-video overflow-hidden">
              <iframe
                src="https://www.youtube.com/embed/i7WnQn7c5bc"
                title="YouTube video player"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <div className="relative aspect-video overflow-hidden">
              <iframe
                src="https://www.youtube.com/embed/U40EpRW5p-c"
                title="YouTube video player"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
              />
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
