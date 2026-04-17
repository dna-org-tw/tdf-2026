'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CollectionList from '@/components/member/CollectionList';
import type { CollectionEntry } from '@/lib/memberCollections';

function CollectionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useTranslation();
  const [collected, setCollected] = useState<CollectionEntry[]>([]);
  const [collectors, setCollectors] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const labels = t.collections;

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch('/api/member/collections');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCollected(data.collected ?? []);
      setCollectors(data.collectors ?? []);
    } catch {
      setCollected([]);
      setCollectors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchLists();
    fetch('/api/member/collections/mark-viewed', { method: 'POST' }).catch(() => {});
  }, [user, fetchLists]);

  const handleRemove = async (memberNo: string) => {
    setCollected((prev) => prev.filter((c) => c.member_no !== memberNo));
    await fetch(`/api/member/collections/${memberNo}`, { method: 'DELETE' });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <main className="pt-24 pb-16 px-4 sm:px-6 flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-slate-500 mb-4">
            {lang === 'zh' ? '請先登入。' : 'Please sign in first.'}
          </p>
          <Link
            href="/me"
            className="inline-block bg-[#10B8D9] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#0EA5C4]"
          >
            {lang === 'zh' ? '前往登入' : 'Go to Sign In'}
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="w-full max-w-2xl mx-auto space-y-8">
          <div>
            <Link
              href="/me"
              className="text-[12px] text-slate-500 hover:text-[#10B8D9] inline-block mb-3"
            >
              ← {labels.backToMe}
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">{labels.pageTitle}</h1>
            <p className="text-slate-500 text-sm">{labels.pageSubtitle}</p>
          </div>

          <section>
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              {labels.sectionCollected} ({collected.length})
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-20 animate-pulse" />
                ))}
              </div>
            ) : (
              <CollectionList
                entries={collected}
                mode="collected"
                labels={{
                  remove: labels.remove,
                  removeConfirm: labels.removeConfirm,
                  newBadge: labels.newBadge,
                  empty: labels.emptyCollected,
                }}
                onRemove={handleRemove}
              />
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              {labels.sectionCollectors} ({collectors.length})
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-20 animate-pulse" />
                ))}
              </div>
            ) : (
              <CollectionList
                entries={collectors}
                mode="collectors"
                labels={{
                  remove: labels.remove,
                  removeConfirm: labels.removeConfirm,
                  newBadge: labels.newBadge,
                  empty: labels.emptyCollectors,
                }}
              />
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </div>
      }
    >
      <CollectionsPage />
    </Suspense>
  );
}
