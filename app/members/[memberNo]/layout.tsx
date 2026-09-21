import type { Metadata } from 'next';

// Individual member passport cards hold personal data (name, location,
// nationality, social links) and exist at scale. Keep them out of the index
// (the /members directory is the indexable surface) while overriding the
// parent's `/members` canonical with each card's own URL.
export async function generateMetadata(
  { params }: { params: Promise<{ memberNo: string }> },
): Promise<Metadata> {
  const { memberNo } = await params;
  return {
    title: 'Member Card',
    robots: { index: false, follow: true },
    alternates: { canonical: `/members/${encodeURIComponent(memberNo)}` },
  };
}

export default function MemberDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
