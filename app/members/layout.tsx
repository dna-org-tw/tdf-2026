import type { Metadata } from 'next';
import { routeAlternates } from '@/lib/seo';

// Public directory of members who opted into `is_public`. Indexable hub page;
// individual /members/[memberNo] cards are noindex (see that segment's layout).
export const metadata: Metadata = {
  title: 'Member Directory',
  description: 'Browse digital nomads taking part in Taiwan Digital Fest 2026.',
  alternates: routeAlternates('/members'),
  openGraph: {
    title: 'Member Directory | Taiwan Digital Fest 2026',
    description: 'Browse digital nomads taking part in Taiwan Digital Fest 2026.',
  },
};

export default function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
