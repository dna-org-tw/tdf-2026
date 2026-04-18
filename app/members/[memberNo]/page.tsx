'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MemberPassport, { type IdentityTier, type MemberProfile } from '@/components/member/MemberPassport';
import CollectButton from '@/components/member/CollectButton';
import Link from 'next/link';

interface PublicProfile {
  member_no: string;
  first_seen_at: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  timezone: string | null;
  tags: string[];
  languages: string[];
  social_links: Record<string, string>;
  tier: string;
  valid_from: string | null;
  valid_until: string | null;
}

function PublicMemberCard() {
  const params = useParams();
  const memberNo = params.memberNo as string;
  const searchParams = useSearchParams();
  const token = searchParams.get('t');
  const { t, lang } = useTranslation();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!memberNo) return;
    const url = token
      ? `/api/members/${encodeURIComponent(memberNo)}?t=${encodeURIComponent(token)}`
      : `/api/members/${encodeURIComponent(memberNo)}`;
    fetch(url)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => d && setData(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [memberNo, token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <main className="pt-24 pb-16 px-4 sm:px-6 flex flex-col items-center justify-center min-h-[60vh]">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {t.memberDetail.notFoundTitle}
          </h1>
          <p className="text-slate-500 mb-6 text-center">
            {t.memberDetail.notFoundDesc}
          </p>
          <Link
            href="/"
            className="inline-block bg-[#10B8D9] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#0EA5C4] transition-colors"
          >
            {t.memberDetail.backHome}
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const profile: MemberProfile = {
    displayName: data.display_name,
    bio: data.bio,
    avatarUrl: data.avatar_url,
    location: data.location,
    timezone: data.timezone,
    tags: data.tags,
    languages: data.languages,
    socialLinks: data.social_links,
    isPublic: true,
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="w-full max-w-2xl mx-auto space-y-6">
          <MemberPassport
            email=""
            memberNo={data.member_no}
            tier={(data.tier || 'follower') as IdentityTier}
            validFrom={data.valid_from}
            validUntil={data.valid_until}
            profile={profile}
            lang={lang}
          />

          {/* Languages */}
          {data.languages.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">
                {t.memberDetail.languages}
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.languages.map((l) => (
                  <span key={l} className="px-2.5 py-1 rounded-full text-[12px] bg-slate-100 text-slate-600">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timezone */}
          {data.timezone && (
            <div className="text-center text-[12px] text-slate-400">
              {data.timezone}
            </div>
          )}

          {/* Collect button */}
          <div className="pt-2">
            <CollectButton
              memberNo={data.member_no}
              token={token}
              lang={lang}
              labels={{
                collect: t.collections.collect,
                collected: t.collections.collected,
                collecting: t.collections.collecting,
                loginToCollect: t.collections.loginToCollect,
                privacyHint: t.collections.privacyHint,
                qrError: t.collections.qrError,
              }}
            />
          </div>

          {/* CTA: get your own card */}
          <div className="text-center pt-4">
            <p className="text-[13px] text-slate-500 mb-3">
              {t.memberDetail.wantCard}
            </p>
            <Link
              href="/me"
              className="inline-block bg-[#10B8D9] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#0EA5C4] transition-colors"
            >
              {t.memberDetail.joinCta}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function PublicMemberPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </div>
      }
    >
      <PublicMemberCard />
    </Suspense>
  );
}
