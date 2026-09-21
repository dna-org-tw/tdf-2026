import type { Metadata } from 'next';
import { Suspense } from 'react';
import UpgradePageContent from '@/components/upgrade/UpgradePageContent';
import { routeAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Upgrade Your Ticket | Taiwan Digital Fest 2026',
  description: 'Upgrade your TDF 2026 ticket tier and unlock more festival experiences.',
  alternates: routeAlternates('/upgrade'),
};

export default function UpgradePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </div>
      }
    >
      <UpgradePageContent />
    </Suspense>
  );
}
