'use client';

import { useState, useEffect, useCallback } from 'react';

interface Subscriber {
  email: string;
  source: string | null;
  created_at: string;
  timezone: string | null;
  country: string | null;
  locale: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  hero_section: '首頁',
  footer: '頁尾',
  follow_us: '追蹤我們',
};

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/admin/subscribers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSubscribers(data.subscribers || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (err) {
      console.error('[Admin Subscribers]', err);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(fetchSubscribers, 300);
    return () => clearTimeout(timer);
  }, [fetchSubscribers]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Taipei',
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">電子報訂閱者</h1>

      {/* Search */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 flex gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 Email..."
          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900 text-sm"
        />
        <span className="text-sm text-slate-500">共 {total} 位訂閱者</span>
        <a
          href={`/api/admin/subscribers/export${search ? `?search=${encodeURIComponent(search)}` : ''}`}
          className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] rounded-lg hover:bg-[#0EA5C4] transition-colors whitespace-nowrap"
          title={search ? '匯出目前搜尋結果' : '匯出全部訂閱者'}
        >
          匯出 CSV
        </a>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">來源</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">國家</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">時區</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">訂閱日期</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : subscribers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    沒有符合條件的訂閱者
                  </td>
                </tr>
              ) : (
                subscribers.map((s) => (
                  <tr key={s.email} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">{s.email}</td>
                    <td className="px-4 py-3 text-slate-600">{SOURCE_LABELS[s.source || ''] || s.source || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.country || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.timezone || '-'}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatDate(s.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一頁
          </button>
          <span className="text-sm text-slate-500">
            第 {page} / {totalPages} 頁
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}
