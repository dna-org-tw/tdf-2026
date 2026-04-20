import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Taiwan Digital Fest 2026 Privacy Policy — how we collect, use, and protect your personal information when you use our website, buy tickets, or subscribe to updates.',
  openGraph: {
    title: 'Privacy Policy | Taiwan Digital Fest 2026',
    description: 'How Taiwan Digital Fest 2026 handles your personal data.',
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
