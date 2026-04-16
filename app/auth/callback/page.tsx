'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const errorMessages: Record<string, { en: string; zh: string }> = {
  missing_token: {
    en: 'Invalid or missing login link.',
    zh: '無效或缺少登入連結。',
  },
  invalid_token: {
    en: 'This login link is invalid.',
    zh: '此登入連結無效。',
  },
  expired: {
    en: 'This login link has expired. Please request a new one.',
    zh: '此登入連結已過期，請重新申請。',
  },
  already_used: {
    en: 'This login link has already been used. Please request a new one.',
    zh: '此登入連結已被使用，請重新申請。',
  },
  rate_limited: {
    en: 'Too many attempts. Please wait a few minutes and try again.',
    zh: '嘗試次數過多，請稍候再試。',
  },
  server_error: {
    en: 'An unexpected error occurred. Please try again.',
    zh: '發生意外錯誤，請重試。',
  },
};

function CallbackContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error');

  if (!errorCode) {
    // No error param — this page is only reached on error (success redirects to /member)
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
      </div>
    );
  }

  const msg = errorMessages[errorCode] || errorMessages.server_error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full mx-4 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Login Failed / 登入失敗</h1>
        <p className="text-slate-600 mb-1">{msg.en}</p>
        <p className="text-slate-500 text-sm mb-6">{msg.zh}</p>
        <div className="flex flex-col gap-3">
          <Link
            href="/me"
            className="inline-block bg-[#10B8D9] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#0EA5C4] transition-colors"
          >
            Resend Login Link / 重新寄送登入連結
          </Link>
          <Link
            href="/"
            className="inline-block text-slate-500 hover:text-slate-700 text-sm transition-colors"
          >
            Back to Home / 回首頁
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
