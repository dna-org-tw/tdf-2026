'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

export default function AboutSection() {
  const { t, lang } = useTranslation();
  const instagramRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!instagramRef.current) return;

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

    const processEmbeds = () => {
      if (window.instgrm) {
        window.instgrm.Embeds.process();
        
        // Try to trigger autoplay after embed is processed
        setTimeout(() => {
          tryAutoPlay();
        }, 1000);
      }
    };

    // Intersection Observer to lazy load Instagram script only when section is visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Only load Instagram script when section comes into view
            const existingScript = document.querySelector('script[src="https://www.instagram.com/embed.js"]');
            
            if (!existingScript) {
              // Load Instagram embed script lazily
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

            // When reel comes into view, try to autoplay
            setTimeout(tryAutoPlay, 500);
            
            // Disconnect observer after loading to avoid repeated loads
            observer.disconnect();
          }
        });
      },
      {
        threshold: 0.1, // Trigger when 10% visible (earlier trigger for better UX)
        rootMargin: '100px', // Start loading 100px before entering viewport
      }
    );

    observer.observe(instagramRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section id="about" className="py-20 md:py-28 lg:py-32 bg-white overflow-hidden relative transition-colors duration-500">
      <div className="container mx-auto px-4 sm:px-6">
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
                  minWidth: '280px',
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
            {/* AEO优化：BLUF原则 - 结论先行，问题导向标题 */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[#1E1F1C] mb-8 leading-tight">
              {t.about.title}
            </h2>
            
            {/* SEO优化：答案块格式 - 整合关键信息，包含核心關鍵字 */}
            <div className="mb-8 p-6 bg-teal-50 rounded-xl border-l-4 border-teal-500">
              <p className="text-lg md:text-xl font-semibold text-[#1E1F1C] leading-relaxed">
                {lang === 'en' 
                  ? 'Join Taiwan Digital Fest 2026 - the premier Digital Nomad Event in Taiwan. A curated remote work summit combining AI workshops, networking opportunities, and startup pitches with scenic biking, ocean tours, and hot springs. Experience geo-arbitrage while connecting with the global nomad tribe in Asia\'s hidden gem.'
                  : '前往山海交界的壯麗之地。專為數位遊牧者策劃的節慶，結合 AI 工作坊、社交活動與創業路演，以及稻浪單車、海洋導覽與溫泉體驗，在台灣最美麗的地區。'
                }
              </p>
            </div>
            
            {/* 關鍵活動資訊摘要 - AEO 優化：結構化數據 */}
            <div className="mb-6 p-6 bg-[#F6F6F6] rounded-xl border border-[#1E1F1C]/10">
              <h3 className="text-xl font-semibold text-[#1E1F1C] mb-4">{t.about.info.title}</h3>
              <dl className="space-y-2 text-[#1E1F1C]/80">
                <div>
                  <dt className="font-semibold inline">{t.about.info.time}</dt>
                  <dd className="inline">
                    <time dateTime="2026-05-01/2026-05-31">{t.about.info.timeValue}</time>
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold inline">{t.about.info.location}</dt>
                  <dd className="inline">{t.about.info.locationValue}</dd>
                </div>
                <div>
                  <dt className="font-semibold inline">{t.about.info.theme}</dt>
                  <dd className="inline">{t.about.info.themeValue}</dd>
                </div>
              </dl>
            </div>

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
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
