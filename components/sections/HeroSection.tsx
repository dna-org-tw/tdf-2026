'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { ChevronDown } from 'lucide-react';

export default function HeroSection() {
  const { t } = useTranslation();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section ref={ref} className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Background Video/Image Layer - Parallax */}
      <motion.div
        style={{ y }}
        className="absolute inset-0 z-0"
      >
        {/* Video Background */}
        <div className="absolute inset-0 bg-[#1E1F1C]/70 z-10" /> {/* Overlay */}
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/images/tdf2025.webp"
          aria-label="Taiwan Digital Fest 2026 promotional video showcasing digital nomads meeting nature and innovation"
          className="w-full h-full object-cover"
        >
          <source src="/videos/tdf2025_short.mov" type="video/quicktime" />
          <source src="/videos/tdf2025_short.mov" type="video/mp4" />
          {/* Fallback image if video fails to load or is not supported */}
          <img
            src="/images/tdf2025.jpg"
            alt="Taiwan Digital Fest 2026 - Where Digital Nomads Meet Nature & Innovation in Taitung and Hualien, Taiwan"
            className="w-full h-full object-cover"
          />
        </video>
      </motion.div>

      {/* Content Layer */}
      <motion.div
        style={{ opacity }}
        className="relative z-20 text-center px-6 max-w-5xl mx-auto text-white"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-lg md:text-2xl font-medium tracking-widest mb-4 uppercase text-[#10B8D9]"
        >
          <time dateTime="2026-05-01/2026-05-31" className="font-semibold">
            {t.hero.dateLocation}
          </time>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-5xl md:text-8xl font-bold font-display tracking-tight mb-6 leading-tight drop-shadow-2xl"
        >
          {t.hero.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-xl md:text-3xl font-light text-white/90 mb-12"
        >
          {t.hero.subtitle}
        </motion.p>

        <div className="flex flex-col items-center gap-4">
          {/* 第一行：主要 CTA */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            {/* 發光動畫層 */}
            <motion.div
              className="absolute inset-0 bg-[#10B8D9] rounded-full blur-xl opacity-60"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.4, 0.7, 0.4],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            {/* 脈衝動畫層 */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-[#10B8D9] opacity-50"
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
            {/* 主要按鈕 */}
            <motion.a
              href="#tickets-timeline"
              whileHover={{ 
                scale: 1.08,
                boxShadow: "0 20px 40px rgba(16, 184, 217, 0.4)",
              }}
              whileTap={{ scale: 0.95 }}
              animate={{
                boxShadow: [
                  "0 10px 30px rgba(16, 184, 217, 0.3)",
                  "0 15px 40px rgba(16, 184, 217, 0.5)",
                  "0 10px 30px rgba(16, 184, 217, 0.3)",
                ],
              }}
              transition={{
                boxShadow: {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
                scale: {
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                },
              }}
              className="relative inline-block bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white px-12 md:px-16 py-5 md:py-6 rounded-full text-xl md:text-2xl font-bold tracking-wide transition-all shadow-lg shadow-[#10B8D9]/40"
            >
              <motion.span
                className="relative z-10"
                animate={{
                  textShadow: [
                    "0 0 0px rgba(255, 255, 255, 0)",
                    "0 0 10px rgba(255, 255, 255, 0.3)",
                    "0 0 0px rgba(255, 255, 255, 0)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {t.hero.cta}
              </motion.span>
            </motion.a>
          </motion.div>
          
          {/* 第二行：次要 CTA */}
          <div className="flex flex-wrap justify-center gap-4">
            <motion.a
              href="https://forms.gle/pVc6oTEi1XZ1pAR49"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="inline-block bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border-2 border-white/50 px-6 md:px-8 py-2.5 md:py-3 rounded-full text-sm md:text-base font-bold tracking-wide transition-all shadow-lg"
            >
              {t.footer.callForSpeakers}
            </motion.a>
            <motion.a
              href="https://forms.gle/SPCggMHifbE3oqkk7"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.5, delay: 1.0 }}
              className="inline-block bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border-2 border-white/50 px-6 md:px-8 py-2.5 md:py-3 rounded-full text-sm md:text-base font-bold tracking-wide transition-all shadow-lg"
            >
              {t.footer.callForVolunteers}
            </motion.a>
          </div>
        </div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/70 z-20"
      >
        <ChevronDown size={32} />
      </motion.div>
    </section>
  );
}
