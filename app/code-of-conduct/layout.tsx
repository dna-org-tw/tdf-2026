import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Code of Conduct',
  description: 'Taiwan Digital Fest 2026 Code of Conduct. All attendees, speakers, sponsors, and volunteers agree to provide a harassment-free, inclusive experience for everyone.',
  openGraph: {
    title: 'Code of Conduct | Taiwan Digital Fest 2026',
    description: 'Taiwan Digital Fest 2026 Code of Conduct. We expect cooperation from all participants to help ensure a safe environment for everybody.',
  },
};

export default function CodeOfConductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
