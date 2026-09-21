import type { Metadata } from 'next';

// Transient vote-confirmation landing (reached from one-time email/IG links).
// Not a content page — keep it out of the index instead of letting it inherit
// the root's indexable, homepage-canonical metadata.
export const metadata: Metadata = {
  title: 'Confirm Your Vote',
  robots: { index: false, follow: false },
};

export default function AwardConfirmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
