'use client';

import { useState } from 'react';
import { Mail, Send, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  lang: 'en' | 'zh';
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailChangeForm({ lang }: Props) {
  const { user, refreshSession } = useAuth();
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState<'enter' | 'verify'>('enter');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const t = lang === 'zh' ? {
    label: '帳號電子郵件',
    edit: '變更',
    cancel: '取消',
    newEmail: '新的電子郵件',
    newEmailPlaceholder: 'new@example.com',
    sendCode: '寄送驗證碼',
    sending: '寄送中…',
    codeSent: '驗證碼已寄至 {email}，請於 10 分鐘內輸入。',
    code: '驗證碼',
    codePlaceholder: '6 位數驗證碼',
    confirm: '完成變更',
    confirming: '變更中…',
    success: '電子郵件已變更為 {email}。',
    sameAsCurrent: '新郵件不可與目前相同',
    invalidEmail: '電子郵件格式不正確',
    invalidCode: '請輸入 6 位數驗證碼',
    emailInUse: '此電子郵件已被其他帳號使用',
    rateLimited: '嘗試次數過多，請稍後再試',
    expired: '驗證碼已過期或無效',
    failed: '操作失敗，請稍後再試',
    resend: '重寄驗證碼',
    backToEnter: '改用其他電子郵件',
  } : {
    label: 'Account email',
    edit: 'Change',
    cancel: 'Cancel',
    newEmail: 'New email',
    newEmailPlaceholder: 'new@example.com',
    sendCode: 'Send code',
    sending: 'Sending…',
    codeSent: 'A code was sent to {email}. Enter it within 10 minutes.',
    code: 'Verification code',
    codePlaceholder: '6-digit code',
    confirm: 'Confirm change',
    confirming: 'Updating…',
    success: 'Email updated to {email}.',
    sameAsCurrent: "New email can't be the same as the current one",
    invalidEmail: 'Invalid email format',
    invalidCode: 'Enter the 6-digit code',
    emailInUse: 'That email is already linked to another account',
    rateLimited: 'Too many attempts, please try again later',
    expired: 'Code is expired or invalid',
    failed: 'Operation failed, please try again',
    resend: 'Resend code',
    backToEnter: 'Use a different email',
  };

  const reset = () => {
    setEditing(false);
    setStep('enter');
    setNewEmail('');
    setCode('');
    setError('');
    setInfo('');
  };

  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setInfo('');

    const trimmed = newEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      setError(t.invalidEmail);
      return;
    }
    if (trimmed === (user?.email ?? '').trim().toLowerCase()) {
      setError(t.sameAsCurrent);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/email/request-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 || data?.error === 'email_in_use') setError(t.emailInUse);
        else if (res.status === 429 || data?.error === 'rate_limited') setError(t.rateLimited);
        else setError(t.failed);
        return;
      }
      setInfo(t.codeSent.replace('{email}', trimmed));
      setStep('verify');
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(code.trim())) {
      setError(t.invalidCode);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/email/confirm-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: newEmail.trim().toLowerCase(), code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) setError(t.expired);
        else if (res.status === 409) setError(t.emailInUse);
        else setError(t.failed);
        return;
      }
      setInfo(t.success.replace('{email}', data.email ?? newEmail));
      // Refresh AuthContext so the displayed email updates everywhere
      await refreshSession();
      setTimeout(() => reset(), 1500);
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  if (!user?.email) return null;

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
        <div className="min-w-0 flex items-center gap-2.5">
          <Mail className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">{t.label}</p>
            <p className="text-[14px] text-slate-800 truncate">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 text-[13px] font-medium text-[#10B8D9] hover:text-[#0EA5C4] transition-colors px-2 py-1"
        >
          {t.edit}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">{t.label}</p>
        <button
          type="button"
          onClick={reset}
          className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          {t.cancel}
        </button>
      </div>

      {step === 'enter' && (
        <form onSubmit={handleSendCode} className="space-y-2.5">
          <p className="text-[12px] text-slate-500">
            {lang === 'zh'
              ? <>目前：<span className="font-mono text-slate-700">{user.email}</span></>
              : <>Current: <span className="font-mono text-slate-700">{user.email}</span></>}
          </p>
          <label className="block">
            <span className="block text-[11px] font-medium text-slate-600 mb-1">{t.newEmail}</span>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t.newEmailPlaceholder}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-[#10B8D9]"
              autoFocus
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy || !newEmail}
            className="inline-flex items-center gap-2 bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:bg-slate-300 text-white font-semibold py-2 px-4 rounded-lg text-[13px] transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {busy ? t.sending : t.sendCode}
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleConfirm} className="space-y-2.5">
          {info && (
            <p className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-start gap-2">
              <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{info}</span>
            </p>
          )}
          <label className="block">
            <span className="block text-[11px] font-medium text-slate-600 mb-1">{t.code}</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder={t.codePlaceholder}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[16px] font-mono tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-[#10B8D9]"
              autoFocus
              required
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="inline-flex items-center gap-2 bg-[#0E0E10] hover:bg-[#2A2A2E] disabled:bg-slate-300 text-white font-semibold py-2 px-4 rounded-lg text-[13px] transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {busy ? t.confirming : t.confirm}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setStep('enter'); setCode(''); setError(''); }}
              className="text-[12px] text-slate-500 hover:text-slate-700 transition-colors"
            >
              {t.backToEnter}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
