'use client';

import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info, Mail } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { getUserInfo } from '@/lib/userInfo';
import { getVisitorFingerprint } from '@/lib/visitorStorage';

interface FollowModalWithFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
  initialEmail?: string;
}

export default function FollowModalWithForm({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialEmail = ''
}: FollowModalWithFormProps) {
  const { t, lang } = useTranslation();
  const { executeRecaptcha } = useRecaptcha('subscribe');
  const [email, setEmail] = useState(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | 'duplicate' | null>(null);
  const [modalMessage, setModalMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setModalType('error');
      setModalMessage(lang === 'en' ? 'Please enter your email address' : '請輸入您的電子郵件地址');
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
        setModalMessage(t.hero.followForm.recaptchaError);
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
          source: 'award_vote',
          recaptchaToken,
          timezone: userInfo.timezone,
          locale: userInfo.locale,
          visitor_fingerprint: getVisitorFingerprint(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // 處理重複訂閱的情況
        if (response.status === 409) {
          setModalType('duplicate');
          setModalMessage(result.error || t.hero.followForm.duplicateMessage);
          // 即使重复订阅，也视为成功（用户已经订阅了）
          setTimeout(() => {
            onSuccess(trimmedEmail);
            onClose();
          }, 1500);
          return;
        }

        setModalType('error');
        setModalMessage(result.error || t.hero.followForm.errorMessage);
        setIsSubmitting(false);
        return;
      }

      setModalType('success');
      setModalMessage(result.message || t.hero.followForm.successMessage);
      
      // 成功后调用回调并关闭 modal
      setTimeout(() => {
        onSuccess(trimmedEmail);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Follow subscription error:', err);
      setModalType('error');
      setModalMessage(t.hero.followForm.errorMessage);
      setIsSubmitting(false);
    }
  };

  const getIcon = () => {
    switch (modalType) {
      case 'success':
        return <CheckCircle2 className="w-16 h-16 text-[#10B8D9]" />;
      case 'duplicate':
        return <Info className="w-16 h-16 text-[#10B8D9]" />;
      case 'error':
        return <AlertCircle className="w-16 h-16 text-red-500" />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    if (modalType) {
      switch (modalType) {
        case 'success':
          return t.followModal.successTitle;
        case 'duplicate':
          return t.followModal.duplicateTitle;
        case 'error':
          return t.followModal.errorTitle;
        default:
          return '';
      }
    }
    return lang === 'en' ? 'Follow Us to Vote' : '請先關注我們以進行投票';
  };

  const getMessage = () => {
    if (modalType) {
      return modalMessage;
    }
    return lang === 'en' 
      ? 'Please subscribe to our newsletter first to vote. Enter your email address below:'
      : '請先訂閱我們的電子報以進行投票。請在下方輸入您的電子郵件地址：';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1E1F1C] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-white/10">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h3 className="text-2xl font-display font-bold text-white">
                  {getTitle()}
                </h3>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                  aria-label={t.followModal.close}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {modalType ? (
                  // 显示结果消息
                  <div className="text-center">
                    <div className="flex justify-center mb-4">
                      {getIcon()}
                    </div>
                    <p className="text-base text-white/90 leading-relaxed mb-6">
                      {getMessage()}
                    </p>
                    {modalType === 'error' && (
                      <motion.button
                        onClick={() => {
                          setModalType(null);
                          setModalMessage('');
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-[#10B8D9]/40"
                      >
                        {lang === 'en' ? 'Try Again' : '重試'}
                      </motion.button>
                    )}
                  </div>
                ) : (
                  // 显示表单
                  <>
                    <p className="text-base text-white/90 leading-relaxed mb-6 text-center">
                      {getMessage()}
                    </p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t.hero.followForm.emailPlaceholder}
                          required
                          className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent transition-all"
                          disabled={isSubmitting}
                        />
                      </div>
                      <motion.button
                        type="submit"
                        disabled={isSubmitting || !email.trim()}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-[#10B8D9]/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting 
                          ? (lang === 'en' ? 'Subscribing...' : '訂閱中...')
                          : (lang === 'en' ? 'Subscribe & Continue Voting' : '訂閱並繼續投票')}
                      </motion.button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
