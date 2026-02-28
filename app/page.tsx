import { Suspense } from 'react';
import HomeContent from '@/components/HomeContent';
import PageSkeleton from '@/components/PageSkeleton';
import { getTaitungAccommodations } from '@/lib/parseNomadStores';

// 啟用 ISR (Incremental Static Regeneration) 以優化效能
export const revalidate = 3600; // 每小時重新驗證一次

export default function Home() {
  const taitungStores = getTaitungAccommodations();

  return (
    <main className="min-h-screen relative overflow-hidden">
      <Suspense fallback={<PageSkeleton />}>
        <HomeContent taitungStores={taitungStores} />
      </Suspense>
    </main>
  );
}
