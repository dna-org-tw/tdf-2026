'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Individual order detail pages are no longer supported.
 * Orders are now accessed through the authenticated order query page.
 */
export default function OrderDetailPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/order/query');
  }, [router]);

  return (
    <main className="min-h-screen bg-[#1E1F1C] text-white flex items-center justify-center px-4">
      <p className="text-white/70">Redirecting...</p>
    </main>
  );
}
