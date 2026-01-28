'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';
import { ChevronDown } from 'lucide-react';
import { trackEvent, trackCustomEvent } from '@/components/FacebookPixel';
import FollowModal from '@/components/FollowModal';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { getUserInfo } from '@/lib/userInfo';

export default function HeroSection() {
  const { t } = useTranslation();
  const { executeRecaptcha } = useRecaptcha('subscribe');
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | 'duplicate' | null>(null);
  const [modalMessage, setModalMessage] = useState('');

  const handleFollowSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setModalType('error');
      setModalMessage(t.hero.followForm.emptyEmailError);
      setModalOpen(true);
      return;
    }

    trackCustomEvent('HeroFollowSubmit', { location: 'hero_section' });

    try {
      setIsSubmitting(true);

      // 执行 reCAPTCHA 验证
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (recaptchaError) {
        setModalType('error');
        setModalMessage(t.hero.followForm.recaptchaError);
        setModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      // 获取用户信息
      const userInfo = getUserInfo();

      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          source: 'hero_section',
          recaptchaToken,
          timezone: userInfo.timezone,
          locale: userInfo.locale,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // 處理重複訂閱的情況
        if (response.status === 409) {
          setModalType('duplicate');
          setModalMessage(t.hero.followForm.duplicateMessage);
          setEmail('');
          setModalOpen(true);
          trackCustomEvent('HeroFollowDuplicate', { location: 'hero_section' });
          return;
        }

        setModalType('error');
        setModalMessage(result.error || t.hero.followForm.errorMessage);
        setModalOpen(true);
        trackCustomEvent('HeroFollowError', {
          location: 'hero_section',
          reason: 'api_error',
          status: response.status,
          message: result.error,
        });
        return;
      }

      setModalType('success');
      setModalMessage(result.message || t.hero.followForm.successMessage);
      setEmail('');
      setModalOpen(true);
      trackEvent('Lead', {
        content_name: 'Hero Free Follow Form',
        content_category: 'Engagement',
      });
      trackCustomEvent('HeroFollowSuccess', { location: 'hero_section' });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Hero follow submit error:', err);
      setModalType('error');
      setModalMessage(t.hero.followForm.errorMessage);
      setModalOpen(true);
      trackCustomEvent('HeroFollowError', {
        location: 'hero_section',
        reason: 'network_error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section ref={ref} className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Background Image Layer - Parallax */}
      <motion.div
        style={{ y }}
        className="absolute inset-0 z-0"
      >
        {/* Image Background */}
        <div className="absolute inset-0 bg-[#1E1F1C] z-0" /> {/* Fallback background */}
        <div className="absolute inset-0 bg-[#1E1F1C]/70 z-10" /> {/* Overlay */}
        <Image
          src="/images/tdf2025.webp"
          alt="Taiwan Digital Fest 2026 - Where Digital Nomads Meet Nature & Innovation in Taitung and Hualien, Taiwan"
          fill
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1920px"
          quality={75}
          className="object-cover"
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
        />
      </motion.div>

      {/* Content Layer */}
      <motion.div
        style={{ opacity }}
        className="relative z-20 text-center px-4 sm:px-6 max-w-5xl mx-auto text-white"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-sm sm:text-lg md:text-2xl font-medium tracking-widest mb-4 uppercase text-[#10B8D9]"
        >
          <time dateTime="2026-05-01/2026-05-31" className="font-semibold">
            {t.hero.dateLocation}
          </time>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-3xl sm:text-5xl md:text-8xl font-bold font-display tracking-tight mb-6 leading-tight drop-shadow-2xl"
        >
          {t.hero.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-base sm:text-xl md:text-3xl font-light text-white/90 mb-8 sm:mb-12"
        >
          {t.hero.subtitle}
        </motion.p>

        <div className="flex flex-col items-center gap-4">
          {/* 第一行：關注我們（Email 訂閱） */}
          <motion.div
            className="w-full max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <form
              onSubmit={handleFollowSubmit}
              className="relative bg-black/50 border-2 border-[#10B8D9]/30 rounded-3xl px-6 sm:px-8 md:px-10 py-6 sm:py-8 backdrop-blur-md shadow-2xl shadow-[#10B8D9]/20"
            >
              {/* 發光動畫層 */}
              <motion.div
                className="absolute inset-0 bg-[#10B8D9] rounded-3xl blur-2xl opacity-20"
                animate={{
                  opacity: [0.15, 0.25, 0.15],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              
              <div className="relative z-10">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 text-center">
                  {t.hero.followForm.title}
                </h3>
                <p className="text-sm sm:text-base text-white/70 mb-6 text-center">
                  {t.hero.followForm.description}
                </p>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1">
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={t.hero.followForm.emailPlaceholder}
                      className="w-full rounded-xl px-4 py-3 sm:py-3.5 bg-black/60 border border-white/20 text-base sm:text-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent transition-all"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                    disabled={isSubmitting}
                    className="relative whitespace-nowrap rounded-xl bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white font-bold text-base sm:text-lg px-8 sm:px-10 py-3 sm:py-3.5 shadow-lg shadow-[#10B8D9]/40 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {isSubmitting ? (
                      <span>{t.hero.followForm.submitting}</span>
                    ) : (
                      <motion.span
                        animate={{
                          textShadow: [
                            "0 0 0px rgba(255, 255, 255, 0)",
                            "0 0 8px rgba(255, 255, 255, 0.3)",
                            "0 0 0px rgba(255, 255, 255, 0)",
                          ],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        {t.hero.followForm.submitButton}
                      </motion.span>
                    )}
                  </motion.button>
                </div>
              </div>
            </form>
          </motion.div>
          
          {/* 第二行：次要 CTA */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
            <motion.a
              href="https://forms.gle/pVc6oTEi1XZ1pAR49"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent('Lead', {
                  content_name: 'Call for Speakers',
                  content_category: 'CTA',
                });
                trackCustomEvent('CallForSpeakersClick', { location: 'hero_section' });
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="inline-block bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border-2 border-white/50 px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-full text-xs sm:text-sm md:text-base font-bold tracking-wide transition-all shadow-lg"
            >
              {t.hero.ctaSpeakers}
            </motion.a>
            <motion.a
              href="https://forms.gle/SPCggMHifbE3oqkk7"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent('Lead', {
                  content_name: 'Call for Volunteers',
                  content_category: 'CTA',
                });
                trackCustomEvent('CallForVolunteersClick', { location: 'hero_section' });
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.5, delay: 1.0 }}
              className="inline-block bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border-2 border-white/50 px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-full text-xs sm:text-sm md:text-base font-bold tracking-wide transition-all shadow-lg"
            >
              {t.hero.ctaVolunteers}
            </motion.a>
          </div>
          
          {/* 第三行：合作夥伴 CTA */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
            <motion.a
              href="https://forms.gle/KqJGkQhdWmSZVTdv6"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent('Lead', {
                  content_name: 'Call for Partners',
                  content_category: 'CTA',
                });
                trackCustomEvent('CallForPartnersClick', { location: 'hero_section' });
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.5, delay: 1.1 }}
              className="inline-block bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border-2 border-white/50 px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-full text-xs sm:text-sm md:text-base font-bold tracking-wide transition-all shadow-lg"
            >
              {t.hero.ctaPartners}
            </motion.a>
            <motion.a
              href="https://forms.gle/EofTp9Qso27jEeeY7"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent('Lead', {
                  content_name: 'Call for Side Events',
                  content_category: 'CTA',
                });
                trackCustomEvent('CallForSideEventsClick', { location: 'hero_section' });
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.5, delay: 1.2 }}
              className="inline-block bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border-2 border-white/50 px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-full text-xs sm:text-sm md:text-base font-bold tracking-wide transition-all shadow-lg"
            >
              {t.hero.ctaSideEvents}
            </motion.a>
            <motion.a
              href="https://forms.gle/aN3LbaHy8iV5xqyi8"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackCustomEvent('CallForSponsorsClick', { location: 'hero_section' });
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.5, delay: 1.3 }}
              className="inline-block bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border-2 border-white/50 px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-full text-xs sm:text-sm md:text-base font-bold tracking-wide transition-all shadow-lg"
            >
              {t.hero.ctaSponsors}
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

      {/* Follow Modal */}
      <FollowModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        message={modalMessage}
      />
    </section>
  );
}