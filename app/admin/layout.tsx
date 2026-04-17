// app/admin/layout.tsx
'use client';

import { useState, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

function AdminNav() {
  const { user, signOut } = useAuth();

  return (
    <nav className="bg-[#1E1F1C] text-white px-4 sm:px-6 py-3 sm:py-4">
      <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        <div className="flex items-center gap-3 sm:gap-6 overflow-x-auto flex-1 min-w-0">
          <Link href="/admin" className="text-[#10B8D9] font-bold text-base sm:text-lg whitespace-nowrap shrink-0">
            TDF 2026 Admin
          </Link>
          <Link href="/admin/members" className="text-sm text-slate-300 hover:text-white transition-colors whitespace-nowrap">
            會員管理
          </Link>
          <Link href="/admin/orders" className="text-sm text-slate-300 hover:text-white transition-colors whitespace-nowrap">
            訂單管理
          </Link>
          <Link href="/admin/send" className="text-sm text-slate-300 hover:text-white transition-colors whitespace-nowrap">
            發送通知
          </Link>
          <Link href="/admin/history" className="text-sm text-slate-300 hover:text-white transition-colors whitespace-nowrap">
            發送紀錄
          </Link>
          <Link href="/admin/luma-sync" className="text-sm text-slate-300 hover:text-white transition-colors whitespace-nowrap">
            Luma 同步
          </Link>
          <Link href="/admin/settings" className="text-sm text-slate-300 hover:text-white transition-colors whitespace-nowrap">
            設定
          </Link>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <span className="hidden md:inline text-sm text-slate-400 truncate max-w-[200px]">{user?.email}</span>
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-[#10B8D9] transition-colors whitespace-nowrap"
          >
            回到前台
          </Link>
          <button
            onClick={signOut}
            className="text-sm text-slate-400 hover:text-red-400 transition-colors whitespace-nowrap"
          >
            登出
          </button>
        </div>
      </div>
    </nav>
  );
}

function LoginForm() {
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
        throw new Error(data.error || '發送失敗');
      }
      setStep('code');
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '發送失敗');
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
      if (!res.ok) throw new Error('驗證碼無效');
      await refreshSession();
    } catch {
      setError('驗證碼無效或已過期');
    } finally {
      setVerifying(false);
    }
  };

  if (step === 'code') {
    return (
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">輸入驗證碼</h1>
        <p className="text-slate-600 mb-6 text-center text-sm">驗證碼已發送至 {email}</p>
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900 text-center text-2xl tracking-[0.3em] font-mono"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {verifying ? '驗證中...' : '驗證'}
          </button>
        </form>
        <button
          onClick={() => { setStep('email'); setError(''); setCode(''); }}
          className="mt-3 w-full text-sm text-slate-500 hover:underline text-center"
        >
          使用其他信箱
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">管理後台登入</h1>
      <p className="text-slate-600 mb-6 text-center text-sm">請使用 @dna.org.tw 信箱登入</p>
      <form onSubmit={handleSendCode} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@dna.org.tw"
          required
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {sending ? '發送中...' : '發送驗證碼'}
        </button>
      </form>
    </div>
  );
}

const ADMIN_EMAIL_DOMAIN = 'dna.org.tw';

function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <LoginForm />
      </div>
    );
  }

  if (!user.email?.endsWith(`@${ADMIN_EMAIL_DOMAIN}`)) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">存取被拒絕</h1>
          <p className="text-slate-600 mb-4">此頁面僅限 @{ADMIN_EMAIL_DOMAIN} 帳號存取。</p>
          <p className="text-sm text-slate-400">目前登入帳號：{user.email}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <AdminNav />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </div>
      }
    >
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
