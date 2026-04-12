import { Suspense } from 'react';
import HomeContent from '@/components/HomeContent';
import PageSkeleton from '@/components/PageSkeleton';

// 啟用 ISR (Incremental Static Regeneration) 以優化效能
export const revalidate = 3600; // 每小時重新驗證一次

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      <Suspense fallback={<PageSkeleton />}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
