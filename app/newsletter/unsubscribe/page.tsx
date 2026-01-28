'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('缺少取消訂閱的連結參數。');
      return;
    }

    const unsubscribe = async () => {
      try {
        setStatus('loading');
        setMessage('正在處理取消訂閱...');

        const res = await fetch(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: '取消訂閱失敗' }));
          throw new Error(errorData.error || '取消訂閱失敗');
        }

        const data = await res.json();
        setStatus('success');
        setMessage(data.message || '已成功取消訂閱。');
      } catch (error) {
        console.error('Unsubscribe error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : '取消訂閱失敗，請稍後再試。');
      }
    };

    unsubscribe();
  }, [token]);

  return (
    <main className="min-h-screen bg-[#1E1F1C] text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        {status === 'loading' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 border border-blue-400/40 mb-2">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">處理中...</h1>
            <p className="text-white/80 text-sm md:text-base leading-relaxed">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-400/40 mb-2">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">已成功取消訂閱</h1>
            <p className="text-white/80 text-sm md:text-base leading-relaxed">{message}</p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-left">
              <p className="text-white/70">
                您已成功取消訂閱台灣數位遊牧者社群的電子報。我們很遺憾看到您離開，但我們尊重您的決定。
              </p>
              <p className="text-white/70 mt-3">
                如果您改變主意，隨時歡迎重新訂閱我們的電子報。
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={() => router.push('/')}
                className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                返回首頁
              </button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-400/40 mb-2">
              <span className="text-3xl">✗</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">取消訂閱失敗</h1>
            <p className="text-white/80 text-sm md:text-base leading-relaxed">{message}</p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-left">
              <p className="text-white/70">
                可能的原因：
              </p>
              <ul className="list-disc list-inside text-white/70 mt-2 space-y-1">
                <li>取消訂閱連結已過期或無效</li>
                <li>您已經取消訂閱</li>
                <li>系統暫時無法處理您的請求</li>
              </ul>
              <p className="text-white/70 mt-3">
                如果您需要協助，請聯繫我們的客服團隊。
              </p>
            </div>
            <div className="pt-4 space-y-3">
              <button
                onClick={() => {
                  if (token) {
                    setStatus('idle');
                    setMessage('');
                    // 重新嘗試取消訂閱
                    const unsubscribe = async () => {
                      try {
                        setStatus('loading');
                        setMessage('正在處理取消訂閱...');
                        const res = await fetch(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
                        if (!res.ok) {
                          const errorData = await res.json().catch(() => ({ error: '取消訂閱失敗' }));
                          throw new Error(errorData.error || '取消訂閱失敗');
                        }
                        const data = await res.json();
                        setStatus('success');
                        setMessage(data.message || '已成功取消訂閱。');
                      } catch (error) {
                        setStatus('error');
                        setMessage(error instanceof Error ? error.message : '取消訂閱失敗，請稍後再試。');
                      }
                    };
                    unsubscribe();
                  }
                }}
                className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                重新嘗試
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full md:w-auto px-6 py-3 rounded-lg font-semibold text-sm md:text-base bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all duration-200"
              >
                返回首頁
              </button>
            </div>
          </>
        )}

        {status === 'idle' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 border border-blue-400/40 mb-2">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">準備取消訂閱...</h1>
          </>
        )}
      </div>
    </main>
  );
}
