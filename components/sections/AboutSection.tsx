'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

export default function AboutSection() {
  const { t } = useTranslation();
  const instagramRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Function to try autoplay
    const tryAutoPlay = () => {
      if (!instagramRef.current) return;

      // Find the Instagram iframe
      const iframe = instagramRef.current.querySelector('iframe');
      if (!iframe) return;

      // Try to access iframe content (may fail due to CORS)
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const video = iframeDoc.querySelector('video');
          if (video) {
            video.muted = true;
            video.play().catch(() => {
              // Autoplay failed, try clicking play button
              const playButton = iframeDoc.querySelector('button[aria-label*="Play"], button[aria-label*="播放"]');
              if (playButton) {
                (playButton as HTMLButtonElement).click();
              }
            });
          }
        }
      } catch {
        // CORS restriction - try alternative method
        // Send postMessage to iframe (if Instagram supports it)
        iframe.contentWindow?.postMessage({ type: 'play' }, '*');
      }
    };

    // Check if script is already loaded
    const existingScript = document.querySelector('script[src="https://www.instagram.com/embed.js"]');
    
    const processEmbeds = () => {
      if (window.instgrm) {
        window.instgrm.Embeds.process();
        
        // Try to trigger autoplay after embed is processed
        setTimeout(() => {
          tryAutoPlay();
        }, 1000);
      }
    };
    
    if (!existingScript) {
      // Load Instagram embed script
      const script = document.createElement('script');
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);

      // Process embeds after script loads
      script.onload = processEmbeds;
    } else {
      // Script already exists, process embeds after a short delay to ensure it's ready
      setTimeout(processEmbeds, 100);
    }

    // Intersection Observer for autoplay when in view
    if (!instagramRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // When reel comes into view, try to autoplay
            setTimeout(tryAutoPlay, 500);
          }
        });
      },
      {
        threshold: 0.5, // Trigger when 50% visible
        rootMargin: '0px',
      }
    );

    observer.observe(instagramRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section id="about" className="py-24 md:py-32 bg-white overflow-hidden relative">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center gap-16">

          {/* Instagram Reel Side */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="w-full md:w-1/2"
          >
            <div ref={instagramRef} className="relative rounded-2xl overflow-hidden shadow-2xl bg-white">
              <blockquote
                className="instagram-media"
                data-instgrm-permalink="https://www.instagram.com/reel/DLKU-cjpk7G/"
                data-instgrm-version="14"
                style={{
                  background: '#FFF',
                  border: 0,
                  borderRadius: '12px',
                  boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
                  margin: '1px',
                  maxWidth: '100%',
                  minWidth: '326px',
                  padding: 0,
                  width: '99.375%',
                }}
              />
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

            <div className="flex flex-wrap gap-3 mb-12">
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
