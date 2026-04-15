'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { trackEvent } from '@/components/FacebookPixel';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { executeRecaptcha } = useRecaptcha('unsubscribe');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'form'>('idle');
  const [message, setMessage] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('form');
      return;
    }

    const unsubscribe = async () => {
      try {
        setStatus('loading');
        setMessage(t.unsubscribe.processing);

        const res = await fetch(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: t.unsubscribe.errorTitle }));
          throw new Error(errorData.error || t.unsubscribe.errorTitle);
        }

        const data = await res.json();
        setStatus('success');
        setMessage(data.message || t.unsubscribe.successMessage);
        
        trackEvent('Unsubscribe', {
          content_category: 'Newsletter',
        });
      } catch (error) {
        console.error('Unsubscribe error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : t.unsubscribe.errorTitle);
        
      }
    };

    unsubscribe();
  }, [token, t]);

  const handleEmailUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      setStatus('loading');
      setMessage(t.unsubscribe.processing);

      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (err) {
        console.error('reCAPTCHA execution failed:', err);
        setStatus('error');
        setMessage(t.unsubscribe.errorTitle);
        return;
      }

      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), recaptchaToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.unsubscribe.errorTitle);
      }

      setStatus('success');
      setMessage(data.message || t.unsubscribe.successMessage);

      trackEvent('Unsubscribe', {
        content_category: 'Newsletter',
      });
    } catch (error) {
      console.error('Unsubscribe error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : t.unsubscribe.errorTitle);
    }
  };

  return (
    <main className="min-h-screen bg-[#1E1F1C] text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        {status === 'loading' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 border border-blue-400/40 mb-2">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">{t.unsubscribe.loading}</h1>
            <p className="text-white/80 text-sm md:text-base leading-relaxed">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-400/40 mb-2">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">{t.unsubscribe.successTitle}</h1>
            <p className="text-white/80 text-sm md:text-base leading-relaxed">{message}</p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-left">
              <p className="text-white/70">
                {t.unsubscribe.successNote}
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={() => router.push('/')}
                className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {t.unsubscribe.backToHome}
              </button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-400/40 mb-2">
              <span className="text-3xl">✗</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">{t.unsubscribe.errorTitle}</h1>
            <p className="text-white/80 text-sm md:text-base leading-relaxed">{message}</p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-left">
              <p className="text-white/70">
                {t.unsubscribe.errorReasons}
              </p>
              <ul className="list-disc list-inside text-white/70 mt-2 space-y-1">
                <li>{t.unsubscribe.errorReason1}</li>
                <li>{t.unsubscribe.errorReason2}</li>
                <li>{t.unsubscribe.errorReason3}</li>
              </ul>
              <p className="text-white/70 mt-3">
                {t.unsubscribe.errorHelp}
              </p>
            </div>
            <div className="pt-4 space-y-3">
              {token ? (
                <button
                  onClick={() => {
                    setStatus('idle');
                    setMessage('');
                    const unsubscribe = async () => {
                      try {
                        setStatus('loading');
                        setMessage(t.unsubscribe.processing);
                        const res = await fetch(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
                        if (!res.ok) {
                          const errorData = await res.json().catch(() => ({ error: t.unsubscribe.errorTitle }));
                          throw new Error(errorData.error || t.unsubscribe.errorTitle);
                        }
                        const data = await res.json();
                        setStatus('success');
                        setMessage(data.message || t.unsubscribe.successMessage);
                      } catch (error) {
                        setStatus('error');
                        setMessage(error instanceof Error ? error.message : t.unsubscribe.errorTitle);
                      }
                    };
                    unsubscribe();
                  }}
                  className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {t.unsubscribe.retry}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setStatus('form');
                    setMessage('');
                    setEmail('');
                  }}
                  className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {t.unsubscribe.retry}
                </button>
              )}
              <button
                onClick={() => router.push('/')}
                className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all duration-200"
              >
                {t.unsubscribe.backToHome}
              </button>
            </div>
          </>
        )}

        {status === 'form' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 border border-blue-400/40 mb-2">
              <span className="text-3xl">✉</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">{t.unsubscribe.enterEmailTitle}</h1>
            <p className="text-white/80 text-sm md:text-base leading-relaxed">{t.unsubscribe.enterEmailDescription}</p>
            <form onSubmit={handleEmailUnsubscribe} className="space-y-4 text-left">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.unsubscribe.emailPlaceholder}
                required
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent"
              />
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {t.unsubscribe.submitUnsubscribe}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all duration-200"
                >
                  {t.unsubscribe.backToHome}
                </button>
              </div>
            </form>
          </>
        )}

        {status === 'idle' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 border border-blue-400/40 mb-2">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">{t.unsubscribe.preparing}</h1>
          </>
        )}
      </div>
    </main>
  );
}
