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
  const { executeRecaptcha: executeCheckFollowRecaptcha } = useRecaptcha('check_follow');
  const [email, setEmail] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canVote, setCanVote] = useState(false);
  const [isFollowingNow, setIsFollowingNow] = useState(false);

  // Reset state when modal closes
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
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeCheckFollowRecaptcha();
      } catch (err) {
        console.error('reCAPTCHA execution failed:', err);
        setError(lang === 'en' ? 'Unable to verify request. Please try again.' : '無法驗證請求，請再試一次。');
        setIsFollowing(null);
        setCanVote(false);
        return;
      }

      const response = await fetch('/api/award/check-follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToCheck, recaptchaToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check follow status');
      }

      // API call succeeded, set follow status
      setIsFollowing(data.isFollowing);
      setCanVote(data.isFollowing);
      
      // If user is not following, don't set error — show a friendly hint in the Follow Status section
      // Only show error messages when the API call actually fails
    } catch (err) {
      console.error('Failed to check follow status:', err);
      // Only show error for actual API failures
      setError(err instanceof Error ? err.message : 'Failed to check follow status');
      setIsFollowing(null); // Set to null to indicate check failed, don't show follow status
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError(lang === 'en' ? 'Invalid email format' : '無效的電子郵件格式');
      return;
    }

    // Check follow status
    await checkFollowStatus(trimmedEmail);
  };

  const handleVote = () => {
    if (!canVote || !email.trim()) return;

    // Call parent's onEmailSubmit with the email
    // reCAPTCHA verification is handled in page.tsx's handleVote
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
      // Execute reCAPTCHA verification
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (recaptchaError) {
        setError(lang === 'en' ? 'reCAPTCHA verification failed' : 'reCAPTCHA 驗證失敗');
        setIsFollowingNow(false);
        return;
      }

      // Get user info
      const userInfo = getUserInfo();

      // Call subscribe API
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
        // Handle duplicate subscription (treat as success)
        if (response.status === 409) {
          // Even if duplicate, treat as success and re-check follow status
          await checkFollowStatus(email.trim());
          setIsFollowingNow(false);
          return;
        }

        setError(result.error || (lang === 'en' ? 'Failed to subscribe' : '訂閱失敗'));
        setIsFollowingNow(false);
        return;
      }

      // Subscription succeeded, re-check follow status
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
