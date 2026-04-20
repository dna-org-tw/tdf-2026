'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';

export default function LoginForm() {
  const { t } = useTranslation();
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          const mins = Math.max(1, Math.ceil((Number(data.retryAfter) || 60) / 60));
          setError(t.auth.rateLimitedMessage.replace('{minutes}', String(mins)));
          return;
        }
        throw new Error(data.error || 'Failed');
      }

      setStep('code');
      setCode('');
    } catch {
      setError(t.auth.errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setVerifying(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });

      if (!res.ok) {
        throw new Error('Invalid code');
      }

      await refreshSession();
    } catch {
      setError(t.auth.invalidCode);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          const mins = Math.max(1, Math.ceil((Number(data.retryAfter) || 60) / 60));
          setError(t.auth.rateLimitedMessage.replace('{minutes}', String(mins)));
          return;
        }
        throw new Error();
      }
      setCode('');
    } catch {
      setError(t.auth.errorMessage);
    } finally {
      setSending(false);
    }
  };

  if (step === 'code') {
    return (
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center">{t.auth.codeSentTitle}</h1>
        <p className="text-slate-600 mb-8 text-center">{t.auth.codeSentMessage}</p>

        <form onSubmit={handleVerifyCode} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t.auth.codePlaceholder}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent text-slate-900 text-center text-2xl tracking-[0.3em] font-mono"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {verifying ? t.auth.verifying : t.auth.verifyCode}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={handleResend}
            disabled={sending}
            className="text-sm text-[#10B8D9] hover:underline disabled:opacity-50"
          >
            {sending ? t.auth.sending : t.auth.resendCode}
          </button>
        </div>
        <div className="mt-2 text-center">
          <button
            onClick={() => { setStep('email'); setError(''); setCode(''); }}
            className="text-sm text-slate-500 hover:underline"
          >
            {email}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center">{t.auth.loginTitle}</h1>
      <p className="text-slate-600 mb-8 text-center">{t.auth.loginDescription}</p>

      <form onSubmit={handleSendCode} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.auth.emailPlaceholder}
          required
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent text-slate-900"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {sending ? t.auth.sending : t.auth.sendCode}
        </button>
      </form>
    </div>
  );
}
