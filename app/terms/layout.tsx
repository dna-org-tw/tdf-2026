import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Taiwan Digital Fest 2026 Terms of Service — ticket purchase, refund and cancellation policy, event liability, governing law.',
  openGraph: {
    title: 'Terms of Service | Taiwan Digital Fest 2026',
    description: 'The agreement that governs your use of fest.dna.org.tw and participation in TDF 2026.',
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
