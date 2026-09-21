import type { Metadata } from 'next';
import { routeAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Festival Guide',
  description: 'How to take part in Taiwan Digital Fest 2026 — tickets, schedule, venues, and everything you need to join the month-long nomad festival in Taitung & Hualien.',
  alternates: routeAlternates('/guide'),
  openGraph: {
    title: 'Festival Guide | Taiwan Digital Fest 2026',
    description: 'How to take part in Taiwan Digital Fest 2026 — tickets, schedule, venues, and more.',
  },
};

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
