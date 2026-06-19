import type { Metadata } from 'next';
import { routeAlternates } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Taiwan Digital Fest 2026 Terms of Service — ticket purchase, refund and cancellation policy, event liability, governing law.',
  alternates: routeAlternates('/terms'),
  openGraph: {
    title: 'Terms of Service | Taiwan Digital Fest 2026',
    description: 'The agreement that governs your use of www.taiwandigitalfest.com/2026 and participation in TDF 2026.',
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
