import type { Metadata } from 'next';
import { routeAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Nomad Award',
  description: 'Vote for your favourite Instagram Reels in the Taiwan Digital Fest 2026 Nomad Award contest.',
  alternates: routeAlternates('/award'),
  openGraph: {
    title: 'Nomad Award | Taiwan Digital Fest 2026',
    description: 'Vote for your favourite Instagram Reels in the TDF 2026 Nomad Award contest.',
  },
};

export default function AwardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
