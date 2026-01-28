'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent, trackCustomEvent } from '@/components/FacebookPixel';
import FollowModal from '@/components/FollowModal';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { useSectionTracking } from '@/hooks/useSectionTracking';

export default function TicketFollowSection() {
  const { t } = useTranslation();
  const { executeRecaptcha } = useRecaptcha('subscribe');
  const [email, setEmail] = useState('');
  useSectionTracking({ sectionId: 'tickets-follow', sectionName: 'Ticket Follow Section', category: 'Engagement' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | 'duplicate' | null>(null);
  const [modalMessage, setModalMessage] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) {
      setModalType('error');
      setModalMessage(t.followUs?.emailPlaceholder || '請輸入您的 Email');
      setModalOpen(true);
      return;
    }

    setIsSubmitting(true);

    try {
      // 执行 reCAPTCHA 验证
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (recaptchaError) {
        setModalType('error');
        setModalMessage(
          recaptchaError instanceof Error
            ? recaptchaError.message
            : 'reCAPTCHA 验证失败，请刷新页面后重试。'
        );
        setModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          source: 'tickets_section',
          recaptchaToken,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setModalType('duplicate');
          setModalMessage(t.followUs?.duplicateMessage || '您已經訂閱過了！歡迎回來！');
          setEmail('');
          setModalOpen(true);
          trackCustomEvent('TicketsFollowDuplicate', { location: 'tickets_section' });
          return;
        }

        setModalType('error');
        setModalMessage(result.error || t.followUs?.errorMessage || '訂閱失敗，請稍後再試。');
        setModalOpen(true);
        trackCustomEvent('TicketsFollowError', {
          location: 'tickets_section',
          reason: 'api_error',
          status: response.status,
          message: result.error,
        });
        return;
      }

      setModalType('success');
      setModalMessage(result.message || t.followUs?.successMessage || '訂閱成功！感謝您的關注 🙌');
      setEmail('');
      setModalOpen(true);
      trackEvent('Lead', {
        content_name: 'Tickets Free Follow Form',
        content_category: 'Engagement',
      });
      trackCustomEvent('TicketsFollowSuccess', { location: 'tickets_section' });
    } catch (err) {
      console.error('Tickets follow submit error:', err);
      setModalType('error');
      setModalMessage(t.followUs?.errorMessage || '訂閱失敗，請稍後再試。');
      setModalOpen(true);
      trackCustomEvent('TicketsFollowError', {
        location: 'tickets_section',
        reason: 'network_error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* 頂部分隔線 - 從深色到亮色的過渡 */}
      <div className="relative h-16 md:h-24 overflow-hidden bg-[#1E1F1C]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1E1F1C] via-[#10B8D9]/20 to-transparent" />
        <svg className="absolute bottom-0 w-full h-12 md:h-16" viewBox="0 0 1200 120" preserveAspectRatio="none" fill="none">
          <path d="M0,120 Q300,60 600,80 T1200,100 L1200,120 L0,120 Z" fill="url(#wave-gradient-top)" />
          <defs>
            <linearGradient id="wave-gradient-top" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10B8D9" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10B8D9" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <section className="relative overflow-hidden py-32 md:py-40 bg-gradient-to-b from-[#0A1A2E] via-[#0D2338] to-[#0A1A2E]">
        {/* 強烈的動態背景漸變 - 使用青色系 */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A1A2E] via-[#10B8D9]/20 via-30% via-[#0D2338] via-60% to-[#0A1A2E]">
          {/* 大型裝飾性光暈效果 - 更明顯 */}
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#10B8D9]/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#0EA5E9]/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#10B8D9]/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '0.75s' }} />
          
          {/* 動態網格背景裝飾 - 更明顯 */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#10B8D9/8_1px,transparent_1px),linear-gradient(to_bottom,#10B8D9/8_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_100%_60%_at_50%_50%,#000_40%,transparent_100%)]" />
        </div>

        {/* 邊框光效 */}
        <div className="absolute inset-0 border-y-2 border-[#10B8D9]/30" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#10B8D9]/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#10B8D9]/50 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-center space-y-10"
          >
            <div className="space-y-6">
              {/* 標題 - 更強烈的漸變文字效果 */}
              <h3 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-extrabold">
                <span className="bg-gradient-to-r from-white via-[#B3E5FC] via-50% to-[#10B8D9] bg-clip-text text-transparent drop-shadow-2xl [text-shadow:0_0_40px_rgba(16,184,217,0.5)]">
                  {t.tickets.undecidedTitle}
                </span>
              </h3>
              
              {/* 副標題 - 更亮的對比 */}
              <p className="text-white text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed font-normal">
                {t.tickets.undecidedSubtitle}
              </p>
            </div>

            {/* Email Subscription Form - 更大的卡片式設計 */}
            <form onSubmit={handleSubscribe} className="w-full max-w-2xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="relative"
              >
                {/* 表單背景光效 */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#10B8D9] via-[#0EA5E9] to-[#10B8D9] rounded-2xl blur-lg opacity-30 animate-pulse" />
                
                <div className="relative flex flex-col sm:flex-row gap-4 p-2 bg-white/5 backdrop-blur-md rounded-2xl border-2 border-white/20 shadow-2xl">
                  <div className="flex-1 relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.followUs?.emailPlaceholder || '請輸入您的 Email'}
                      disabled={isSubmitting}
                      className="
                        w-full px-6 py-5 rounded-xl
                        bg-white/15 backdrop-blur-sm
                        border-2 border-white/30
                        text-white placeholder-white/70
                        focus:outline-none focus:border-[#10B8D9] focus:bg-white/20
                        focus:ring-4 focus:ring-[#10B8D9]/30
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-all duration-300
                        shadow-lg shadow-black/30
                        text-base sm:text-lg
                      "
                      required
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="
                      relative px-10 sm:px-12 py-5 rounded-xl font-bold text-lg sm:text-xl
                      bg-gradient-to-r from-[#10B8D9] via-[#0EA5E9] to-[#10B8D9]
                      text-white
                      hover:from-[#0EA5E9] hover:via-[#10B8D9] hover:to-[#0EA5E9]
                      disabled:opacity-60 disabled:cursor-not-allowed
                      transition-all duration-500
                      shadow-2xl shadow-[#10B8D9]/50 hover:shadow-[#10B8D9]/60
                      transform hover:scale-[1.05] active:scale-[0.98]
                      whitespace-nowrap
                      overflow-hidden
                      border-2 border-[#10B8D9]/50
                    "
                  >
                    <span className="relative z-10">
                      {isSubmitting
                        ? (t.followUs?.submitting || '訂閱中...')
                        : (t.followUs?.submitButton || '立即關注')}
                    </span>
                    {/* 按鈕內部光效 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                  </button>
                </div>
              </motion.div>
            </form>
          </motion.div>
        </div>
      </section>

      {/* 底部分隔線 - 從亮色到白色的過渡 */}
      <div className="relative h-16 md:h-24 overflow-hidden bg-white">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#10B8D9]/10 to-white" />
        <svg className="absolute top-0 w-full h-12 md:h-16" viewBox="0 0 1200 120" preserveAspectRatio="none" fill="none">
          <path d="M0,0 Q300,60 600,40 T1200,20 L1200,0 L0,0 Z" fill="url(#wave-gradient-bottom)" />
          <defs>
            <linearGradient id="wave-gradient-bottom" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10B8D9" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10B8D9" stopOpacity="0.05" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Follow Modal */}
      <FollowModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        message={modalMessage}
      />
    </>
  );
}
