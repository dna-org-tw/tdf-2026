import { Suspense } from 'react';
import HomeContent from '@/components/HomeContent';
import PageSkeleton from '@/components/PageSkeleton';

// Enable ISR (Incremental Static Regeneration) for performance optimization
export const revalidate = 3600; // Revalidate every hour

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      <Suspense fallback={<PageSkeleton />}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
