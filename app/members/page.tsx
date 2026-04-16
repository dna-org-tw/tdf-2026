'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { TIER_ACCENT, type IdentityTier } from '@/components/member/MemberPassport';

interface MemberCard {
  member_no: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  tags: string[];
  languages: string[];
  social_links: Record<string, string>;
  tier: string;
}

function MemberCardItem({ member, t }: { member: MemberCard; t: ReturnType<typeof useTranslation>['t'] }) {
  const tier = (member.tier || 'follower') as IdentityTier;
  const accent = TIER_ACCENT[tier] || TIER_ACCENT.follower;
  const initials = member.display_name
    ? member.display_name.trim().slice(0, 2).toUpperCase()
    : (member.member_no || '??').slice(-2);

  return (
    <Link
      href={`/members/${member.member_no}`}
      className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-3">
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt={member.display_name || ''}
            className="w-12 h-12 rounded-full object-cover shrink-0"
          />
        ) : (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-bold shrink-0 text-sm"
            style={{ backgroundColor: `${accent}20`, color: accent }}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-[#10B8D9] transition-colors">
              {member.display_name || member.member_no || t.members.anonymous}
            </p>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              {tier === 'weekly_backer' ? 'WK' : tier.slice(0, 3)}
            </span>
          </div>
          {member.location && (
            <p className="text-[12px] text-slate-500 truncate">{member.location}</p>
          )}
          {member.bio && (
            <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{member.bio}</p>
          )}
          {member.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {member.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-500"
                >
                  {tag}
                </span>
              ))}
              {member.tags.length > 3 && (
                <span className="text-[10px] text-slate-400">+{member.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function MemberDirectory() {
  const { t, lang } = useTranslation();
  const [members, setMembers] = useState<MemberCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const labels = t.members;

  const fetchMembers = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('page', String(p));
      const res = await fetch(`/api/members?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMembers(data.members);
      setTotal(data.total);
      setPageSize(data.pageSize || 20);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers(query, page);
  }, [query, page, fetchMembers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{labels.title}</h1>
            <p className="text-slate-500">{labels.subtitle}</p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={labels.search}
                className="w-full px-4 py-3 pl-11 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent"
              />
              <svg
                viewBox="0 0 24 24"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              {query && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setQuery(''); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                >
                  &times;
                </button>
              )}
            </div>
          </form>

          {/* Count */}
          {!loading && (
            <p className="text-[12px] text-slate-400 mb-4">
              {total} {labels.total}
              {query && ` · "${query}"`}
            </p>
          )}

          {/* List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-20" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">{labels.noResults}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((m) => (
                <MemberCardItem key={m.member_no} member={m} t={t} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-colors"
              >
                {labels.prev}
              </button>
              <span className="text-sm text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-colors"
              >
                {labels.next}
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </div>
      }
    >
      <MemberDirectory />
    </Suspense>
  );
}
