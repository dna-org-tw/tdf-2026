'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent, trackCustomEvent } from '@/components/FacebookPixel';
import FollowModal from '@/components/FollowModal';
import { Mail, CheckCircle2, Zap, Users } from 'lucide-react';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { useSectionTracking } from '@/hooks/useSectionTracking';

export default function FollowUsSection() {
  const { t } = useTranslation();
  const { executeRecaptcha } = useRecaptcha('subscribe');
  useSectionTracking({ sectionId: 'follow-us', sectionName: 'Follow Us Section', category: 'Engagement' });
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'duplicate' | null;
    message: string;
  }>({
    isOpen: false,
    type: null,
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      return;
    }

    setIsSubmitting(true);
    trackCustomEvent('FollowUsSubmit', { location: 'follow_us_section' });

    try {
      // 执行 reCAPTCHA 验证
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (recaptchaError) {
        setModalState({
          isOpen: true,
          type: 'error',
          message:
            recaptchaError instanceof Error
              ? recaptchaError.message
              : 'reCAPTCHA 验证失败，请刷新页面后重试。',
        });
        setIsSubmitting(false);
        return;
      }

      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          source: 'follow_us_section',
          recaptchaToken,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setModalState({
          isOpen: true,
          type: 'success',
          message: data.message || t.followUs.successMessage,
        });
        setEmail('');
        // Track Lead event for successful subscription
        trackEvent('Lead', {
          content_name: 'Follow Us Form',
          content_category: 'Newsletter Subscription',
        });
        trackCustomEvent('FollowUsSuccess', { location: 'follow_us_section' });
      } else if (response.status === 409) {
        setModalState({
          isOpen: true,
          type: 'duplicate',
          message: data.error || t.followUs.duplicateMessage,
        });
        trackCustomEvent('FollowUsDuplicate', { location: 'follow_us_section' });
      } else {
        setModalState({
          isOpen: true,
          type: 'error',
          message: data.error || t.followUs.errorMessage,
        });
        trackCustomEvent('FollowUsError', { location: 'follow_us_section' });
      }
    } catch (error) {
      console.error('Follow Us subscription error:', error);
      setModalState({
        isOpen: true,
        type: 'error',
        message: t.followUs.errorMessage,
      });
      trackCustomEvent('FollowUsError', { location: 'follow_us_section' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section id="follow-us" className="bg-gradient-to-b from-[#1E1F1C] to-[#0F0F0E] py-20 md:py-28 lg:py-32 px-4 sm:px-6 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#10B8D9] rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#00993E] rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 max-w-4xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6">
              {t.followUs.title}
            </h2>
            <p className="text-lg sm:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              {t.followUs.subtitle}
            </p>

            {/* Benefits */}
            <div className="flex flex-wrap justify-center gap-6 mb-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10"
              >
                <CheckCircle2 className="w-5 h-5 text-[#10B8D9]" />
                <span className="text-white/90 text-sm sm:text-base font-medium">
                  {t.followUs.benefits.free}
                </span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10"
              >
                <Zap className="w-5 h-5 text-[#10B8D9]" />
                <span className="text-white/90 text-sm sm:text-base font-medium">
                  {t.followUs.benefits.realTime}
                </span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10"
              >
                <Users className="w-5 h-5 text-[#10B8D9]" />
                <span className="text-white/90 text-sm sm:text-base font-medium">
                  {t.followUs.benefits.community}
                </span>
              </motion.div>
            </div>
          </motion.div>

          {/* Email Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            onSubmit={handleSubmit}
            className="max-w-2xl mx-auto"
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.followUs.emailPlaceholder}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent transition-all"
                  disabled={isSubmitting}
                />
              </div>
              <motion.button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white font-semibold rounded-xl transition-all shadow-lg shadow-[#10B8D9]/40 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isSubmitting ? t.followUs.submitting : t.followUs.submitButton}
              </motion.button>
            </div>
            <p className="text-center text-white/60 text-sm mt-4">
              {t.followUs.privacyNote}
            </p>
          </motion.form>
        </div>
      </section>

      <FollowModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        type={modalState.type}
        message={modalState.message}
      />
    </>
  );
}
