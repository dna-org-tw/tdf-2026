'use client';

import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { getUserInfo } from '@/lib/userInfo';
import { getVisitorFingerprint } from '@/lib/visitorStorage';

interface VoteEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmailSubmit: (email: string) => void;
  onOpenFollowModal?: () => void;
  postId: string;
}

export default function VoteEmailModal({ 
  isOpen, 
  onClose, 
  onEmailSubmit,
  onOpenFollowModal,
  postId 
}: VoteEmailModalProps) {
  const { t, lang } = useTranslation();
  const { executeRecaptcha } = useRecaptcha('subscribe');
  const [email, setEmail] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canVote, setCanVote] = useState(false);
  const [isFollowingNow, setIsFollowingNow] = useState(false);

  // 當 modal 關閉時重置狀態
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setIsChecking(false);
      setIsFollowing(null);
      setError(null);
      setCanVote(false);
      setIsFollowingNow(false);
    }
  }, [isOpen]);

  const checkFollowStatus = async (emailToCheck: string) => {
    setIsChecking(true);
    setError(null);

    try {
      const response = await fetch('/api/award/check-follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToCheck }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check follow status');
      }

      // API 呼叫成功，設定 follow 狀態
      setIsFollowing(data.isFollowing);
      setCanVote(data.isFollowing);
      
      // 如果用戶沒有 follow，不設定錯誤資訊，只顯示友善的提示（在 Follow Status 部分顯示）
      // 只有當 API 呼叫真正失敗時才顯示錯誤資訊
    } catch (err) {
      console.error('Failed to check follow status:', err);
      // 只有真正的 API 錯誤才顯示錯誤資訊
      setError(err instanceof Error ? err.message : 'Failed to check follow status');
      setIsFollowing(null); // 設為 null，表示檢查失敗，不顯示 follow 狀態
      setCanVote(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(lang === 'en' ? 'Please enter your email address' : '請輸入您的電子郵件地址');
      return;
    }

    // 驗證 Email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError(lang === 'en' ? 'Invalid email format' : '無效的電子郵件格式');
      return;
    }

    // 檢查 follow 狀態
    await checkFollowStatus(trimmedEmail);
  };

  const handleVote = () => {
    if (!canVote || !email.trim()) return;

    // 呼叫父元件的 onEmailSubmit，傳遞信箱
    // recaptcha 驗證會在 page.tsx 的 handleVote 中執行
    onEmailSubmit(email.trim());
    onClose();
  };

  const handleFollow = async () => {
    if (!email.trim()) {
      setError(lang === 'en' ? 'Please enter your email address first' : '請先輸入您的電子郵件地址');
      return;
    }

    setIsFollowingNow(true);
    setError(null);

    try {
      // 執行 reCAPTCHA 驗證
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (recaptchaError) {
        setError(lang === 'en' ? 'reCAPTCHA verification failed' : 'reCAPTCHA 驗證失敗');
        setIsFollowingNow(false);
        return;
      }

      // 獲取用戶資訊
      const userInfo = getUserInfo();

      // 呼叫訂閱 API
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          source: 'award_vote',
          recaptchaToken,
          timezone: userInfo.timezone,
          locale: userInfo.locale,
          visitor_fingerprint: getVisitorFingerprint(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // 處理重複訂閱的情況（視為成功）
        if (response.status === 409) {
          // 即使重複訂閱，也視為成功，重新檢查 follow 狀態
          await checkFollowStatus(email.trim());
          setIsFollowingNow(false);
          return;
        }

        setError(result.error || (lang === 'en' ? 'Failed to subscribe' : '訂閱失敗'));
        setIsFollowingNow(false);
        return;
      }

      // 訂閱成功，重新檢查 follow 狀態
      await checkFollowStatus(email.trim());
      setIsFollowingNow(false);
    } catch (err) {
      console.error('Failed to follow:', err);
      setError(err instanceof Error ? err.message : (lang === 'en' ? 'Failed to subscribe' : '訂閱失敗'));
      setIsFollowingNow(false);
    }
  };

  if (!isOpen) return null;

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
                  {lang === 'en' ? 'Enter Email to Vote' : '輸入電子郵件以投票'}
                </h3>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                  aria-label={lang === 'en' ? 'Close' : '關閉'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                        setIsFollowing(null);
                        setCanVote(false);
                      }}
                      placeholder={lang === 'en' ? 'Enter your email address' : '請輸入您的電子郵件地址'}
                      required
                      className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent transition-all"
                      disabled={isChecking}
                    />
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Follow Status */}
                  {isFollowing !== null && !isChecking && (
                    <div className="space-y-2">
                      <div className={`flex items-center gap-2 text-sm ${
                        isFollowing ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {isFollowing ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {lang === 'en' 
                                ? 'You are following us. You can vote now!'
                                : '您已關注我們。現在可以投票了！'}
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4" />
                            <span>
                              {lang === 'en' 
                                ? 'Please follow us first to vote.'
                                : '請先關注我們以進行投票。'}
                            </span>
                          </>
                        )}
                      </div>
                      {!isFollowing && (
                        <motion.button
                          type="button"
                          onClick={handleFollow}
                          disabled={isFollowingNow}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white font-semibold px-4 py-2 rounded-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isFollowingNow ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{lang === 'en' ? 'Following...' : '關注中...'}</span>
                            </>
                          ) : (
                            <span>{lang === 'en' ? 'Follow Us Now' : '立即關注我們'}</span>
                          )}
                        </motion.button>
                      )}
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex gap-3">
                    {isFollowing === null ? (
                      <motion.button
                        type="submit"
                        disabled={isChecking || !email.trim()}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-[#10B8D9]/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isChecking ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{lang === 'en' ? 'Checking...' : '檢查中...'}</span>
                          </>
                        ) : (
                          <span>{lang === 'en' ? 'Check Follow Status' : '檢查關注狀態'}</span>
                        )}
                      </motion.button>
                    ) : (
                      <>
                        <motion.button
                          type="button"
                          onClick={onClose}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {lang === 'en' ? 'Cancel' : '取消'}
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={handleVote}
                          disabled={!canVote}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-[#10B8D9]/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {lang === 'en' ? 'Vote' : '投票'}
                        </motion.button>
                      </>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
