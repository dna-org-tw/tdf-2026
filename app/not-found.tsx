'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';

export default function NotFound() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    // Get query params from current URL (especially the lang param)
    if (typeof window !== 'undefined') {
      const searchParams = window.location.search;
      const redirectUrl = searchParams ? `/${searchParams}` : '/';
      
      // Redirect to home page, preserving query params
      router.replace(redirectUrl);
    }
  }, [router]);

  // Show loading state since redirect will happen shortly
  return (
    <div className="h-screen w-full flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
        <p className="text-slate-600">{t.notFound.redirecting}</p>
      </div>
    </div>
  );
}
