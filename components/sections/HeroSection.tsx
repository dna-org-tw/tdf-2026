'use client';

import { useRef, useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';
import { ChevronDown, Users } from 'lucide-react';
import { trackEvent, trackCustomEvent } from '@/components/FacebookPixel';
import FollowModal from '@/components/FollowModal';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { getUserInfo } from '@/lib/userInfo';
import { getVisitorFingerprint } from '@/lib/visitorStorage';

// Animated counter component
function AnimatedCounter({ value, duration = 3500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(0);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      setIsAnimating(true);
      const startValue = prevValueRef.current;
      const endValue = value;
      const startTime = Date.now();

      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Custom easing: fast start, slow end (pronounced ease-out)
        // Higher-order ease-out for faster acceleration and slower deceleration
        const easeOut = 1 - Math.pow(1 - progress, 5);
        const currentValue = Math.floor(startValue + (endValue - startValue) * easeOut);
        
        setDisplayValue(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(endValue);
          setIsAnimating(false);
        }
      };

      requestAnimationFrame(animate);
      prevValueRef.current = value;
    }
  }, [value, duration]);

  // Format number with thousands separator
  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US');
  };

  return (
    <motion.span
      className="inline-block"
      animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      {formatNumber(displayValue)}
    </motion.span>
  );
}

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
  const [followerCount, setFollowerCount] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | 'duplicate' | null>(null);
  const [modalMessage, setModalMessage] = useState('');

  // Fetch follower count
  useEffect(() => {
    const fetchFollowerCount = async () => {
      try {
        const response = await fetch('/api/newsletter/count');
        const data = await response.json();
        if (response.ok && data.count !== undefined) {
          setFollowerCount(data.count);
        }
      } catch (error) {
        console.error('Failed to fetch follower count:', error);
      } finally {
        setIsLoadingCount(false);
      }
    };

    fetchFollowerCount();
  }, []);

  const handleFollowSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setModalType('error');
      setModalMessage(t.hero.followForm.emptyEmailError);
      setModalOpen(true);
      return;
    }


    try {
      setIsSubmitting(true);

      // Execute reCAPTCHA verification
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

      // Get user info
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
          visitor_fingerprint: getVisitorFingerprint(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle duplicate subscription
        if (response.status === 409) {
          setModalType('duplicate');
          setModalMessage(t.hero.followForm.duplicateMessage);
          setEmail('');
          setModalOpen(true);
          trackCustomEvent('NewsletterSubmitResult', { result: 'duplicate', location: 'hero_section', email: trimmedEmail });
          return;
        }

        setModalType('error');
        setModalMessage(result.error || t.hero.followForm.errorMessage);
        setModalOpen(true);
        trackCustomEvent('NewsletterSubmitResult', {
          result: 'error',
          location: 'hero_section',
          reason: 'api_error',
          status: response.status,
          message: result.error,
          email: trimmedEmail,
        });
        return;
      }

      setModalType('success');
      setModalMessage(result.message || t.hero.followForm.successMessage);
      setEmail('');
      setModalOpen(true);
      // Update follower count
      setFollowerCount((prev) => prev + 1);
      trackEvent('CompleteRegistration', {
        content_name: 'Hero Free Follow Form',
        content_category: 'Newsletter Subscription',
        email: trimmedEmail,
        location: 'hero_section',
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Hero follow submit error:', err);
      setModalType('error');
      setModalMessage(t.hero.followForm.errorMessage);
      setModalOpen(true);
      trackCustomEvent('NewsletterSubmitResult', {
        result: 'error',
        location: 'hero_section',
        reason: 'network_error',
        email: trimmedEmail,
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
        className="relative z-20 text-center px-4 sm:px-6 max-w-5xl mx-auto text-white pt-20 sm:pt-24 md:pt-32"
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
          className="text-2xl sm:text-4xl md:text-6xl font-bold font-display tracking-tight mb-6 leading-tight drop-shadow-2xl"
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
          {/* WhatsApp 社群按鈕 — 主要 CTA */}
          <motion.div
            className="w-full max-w-lg mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <motion.a
              href="https://chat.whatsapp.com/KZsFo7oNvZVCPIF86imk0E"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent('Lead', {
                  content_name: 'Join WhatsApp Community',
                  content_category: 'CTA',
                  location: 'hero_section',
                });
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative inline-flex items-center justify-center gap-2.5 w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-2xl text-lg sm:text-xl md:text-2xl font-bold tracking-wide transition-all shadow-xl shadow-[#25D366]/30"
            >
              {/* 發光動畫層 */}
              <motion.div
                className="absolute inset-0 bg-[#25D366] rounded-2xl blur-2xl opacity-20"
                animate={{
                  opacity: [0.15, 0.3, 0.15],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <Users size={22} className="relative z-10" />
              <span className="relative z-10">{t.hero.ctaWhatsapp}</span>
            </motion.a>
          </motion.div>

          {/* Email 訂閱（次要） */}
          <motion.div
            className="w-full max-w-md mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            <form
              onSubmit={handleFollowSubmit}
              className="relative bg-black/40 border border-white/20 rounded-2xl px-4 sm:px-6 py-4 sm:py-5 backdrop-blur-md"
            >
              <div className="relative z-10">
                {/* Title with Follower Count */}
                {!isLoadingCount ? (
                  <h3 className="text-sm sm:text-base font-semibold text-white/80 mb-3 text-center">
                    <span>{t.hero.followForm.followerCountPrefix}</span>{' '}
                    <span className="text-[#10B8D9]">
                      <AnimatedCounter value={followerCount} />
                    </span>
                    {' '}
                    <span>{t.hero.followForm.followerCountSuffix}</span>
                  </h3>
                ) : (
                  <h3 className="text-sm sm:text-base font-semibold text-white/80 mb-3 text-center">
                    {t.hero.followForm.title}
                  </h3>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1" suppressHydrationWarning>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={t.hero.followForm.emailPlaceholder}
                      className="w-full rounded-lg px-3 py-2 sm:py-2.5 bg-black/50 border border-white/15 text-sm sm:text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#10B8D9] focus:border-transparent transition-all"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                      suppressHydrationWarning
                    />
                  </div>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                    disabled={isSubmitting}
                    className="relative whitespace-nowrap rounded-lg bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white font-semibold text-sm sm:text-base px-5 sm:px-6 py-2 sm:py-2.5 shadow-md shadow-[#10B8D9]/30 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {isSubmitting ? (
                      <span>{t.hero.followForm.submitting}</span>
                    ) : (
                      <span>{t.hero.followForm.submitButton}</span>
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
                  location: 'hero_section',
                });
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
                  location: 'hero_section',
                });
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
                  location: 'hero_section',
                });
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
                  location: 'hero_section',
                });
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
                trackEvent('Lead', {
                  content_name: 'Call for Sponsors',
                  content_category: 'CTA',
                  location: 'hero_section',
                });
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