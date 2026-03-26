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
      // 執行 reCAPTCHA 驗證
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (recaptchaError) {
        setModalType('error');
        setModalMessage(t.hero.followForm.recaptchaError);
        setIsSubmitting(false);
        return;
      }

      // 獲取使用者資訊
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
          onSuccess(trimmedEmail);
          return;
        }

        setModalType('error');
        setModalMessage(result.error || t.hero.followForm.errorMessage);
        setIsSubmitting(false);
        return;
      }

      setModalType('success');
      setModalMessage(result.message || t.hero.followForm.successMessage);
      onSuccess(trimmedEmail);
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
                  // 顯示結果訊息
                  <div className="text-center">
                    <div className="flex justify-center mb-4">
                      {getIcon()}
                    </div>
                    <p className="text-base text-white/90 leading-relaxed mb-4">
                      {getMessage()}
                    </p>
                    {(modalType === 'success' || modalType === 'duplicate') && (
                      <a
                        href="https://chat.whatsapp.com/KZsFo7oNvZVCPIF86imk0E"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-4 w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#25D366]/90 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-[#25D366]/40"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        <span>
                          {lang === 'en'
                            ? 'Join our exclusive Digital Nomad community'
                            : '加入專屬數位遊牧社群'}
                        </span>
                      </a>
                    )}
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
                  // 顯示表單
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
