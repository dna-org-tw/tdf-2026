'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';

export default function NotFound() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    // 從目前 URL 獲取查詢參數（特別是 lang 參數）
    if (typeof window !== 'undefined') {
      const searchParams = window.location.search;
      const redirectUrl = searchParams ? `/${searchParams}` : '/';
      
      // 重定向到首页，保留查询参数
      router.replace(redirectUrl);
    }
  }, [router]);

  // 顯示載入狀態，因為重定向會很快發生
  return (
    <div className="h-screen w-full flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
        <p className="text-slate-600">{t.notFound.redirecting}</p>
      </div>
    </div>
  );
}
