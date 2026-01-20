'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // 从当前 URL 获取查询参数（特别是 lang 参数）
    if (typeof window !== 'undefined') {
      const searchParams = window.location.search;
      const redirectUrl = searchParams ? `/${searchParams}` : '/';
      
      // 重定向到首页，保留查询参数
      router.replace(redirectUrl);
    }
  }, [router]);

  // 显示加载状态，因为重定向会很快发生
  return (
    <div className="h-screen w-full flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
        <p className="text-slate-600">正在跳转到首页...</p>
      </div>
    </div>
  );
}
