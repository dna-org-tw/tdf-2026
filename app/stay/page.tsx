import { Suspense } from 'react';
import StayPageContent from '@/components/stay/StayPageContent';

export const metadata = {
  title: 'Partner Stay | Taiwan Digital Fest 2026',
  description: 'Book the Norden Ruder partner stay for TDF 2026.',
};

export default function StayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <StayPageContent />
    </Suspense>
  );
}
