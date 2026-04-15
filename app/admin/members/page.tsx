'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  type EnrichedMember,
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  MEMBER_STATUSES,
  MEMBER_TIERS,
  TICKET_TIERS,
  STATUS_LABELS_ZH,
  STATUS_BADGE_CLASSES,
  TIER_LABELS_ZH,
  TIER_BADGE_CLASSES,
  TICKET_TIER_LABELS,
  TICKET_TIER_BADGE_CLASSES,
} from '@/lib/members';

interface ApiResponse {
  members: EnrichedMember[];
  total: number;
  totalPages: number;
  page: number;
  summary: {
    byStatus: Record<MemberStatus, number>;
    byTier: Record<MemberTier, number>;
  };
}

export default function MembersPage() {
  const [members, setMembers] = useState<EnrichedMember[]>([]);
  const [summary, setSummary] = useState<ApiResponse['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<MemberStatus[]>([]);
  const [tiers, setTiers] = useState<MemberTier[]>([]);
  const [ticketTier, setTicketTier] = useState<TicketTier | ''>('');
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statuses.length) params.set('status', statuses.join(','));
      if (tiers.length) params.set('tier', tiers.join(','));
      if (ticketTier) params.set('ticketTier', ticketTier);
      if (repeatOnly) params.set('repeat', '1');
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/admin/members?${params}`);
      if (res.ok) {
        const data: ApiResponse = await res.json();
        setMembers(data.members || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('[Admin Members]', err);
    } finally {
      setLoading(false);
    }
  }, [search, statuses, tiers, ticketTier, repeatOnly, page]);

  useEffect(() => {
    const timer = setTimeout(fetchMembers, 300);
    return () => clearTimeout(timer);
  }, [fetchMembers]);

  useEffect(() => { setPage(1); }, [search, statuses, tiers, ticketTier, repeatOnly]);

  const toggleStatus = (s: MemberStatus) => {
    setStatuses((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  };
  const toggleTier = (t: MemberTier) => {
    setTiers((cur) => cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]);
  };

  const formatAmount = (cents: number, currency: string) =>
    `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Taipei',
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">會員管理</h1>

      {summary && (
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <div className="text-xs text-slate-500 mb-2">狀態分佈（點擊切換篩選）</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {MEMBER_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  statuses.includes(s)
                    ? `${STATUS_BADGE_CLASSES[s]} border-current`
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {STATUS_LABELS_ZH[s]} <span className="opacity-70">({summary.byStatus[s]})</span>
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500 mb-2">等級分佈</div>
          <div className="flex flex-wrap gap-2">
            {MEMBER_TIERS.map((t) => (
              <button
                key={t}
                onClick={() => toggleTier(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  tiers.includes(t)
                    ? `${TIER_BADGE_CLASSES[t]} border-current`
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {TIER_LABELS_ZH[t]} <span className="opacity-70">({summary.byTier[t]})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 Email 或姓名..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900 text-sm"
        />
        <select
          value={ticketTier}
          onChange={(e) => setTicketTier(e.target.value as TicketTier | '')}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#10B8D9]"
        >
          <option value="">全部票種</option>
          {TICKET_TIERS.map((t) => (
            <option key={t} value={t}>{TICKET_TIER_LABELS[t]}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={repeatOnly}
            onChange={(e) => setRepeatOnly(e.target.checked)}
            className="rounded border-slate-300 text-[#10B8D9] focus:ring-[#10B8D9]"
          />
          只看多筆訂單
        </label>
        <span className="text-sm text-slate-500">共 {total} 位會員</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">編號</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">姓名</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">狀態</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">等級</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">最高票種</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">訂單</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">總消費</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">分數</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">最近互動</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    沒有符合條件的會員
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const slug = m.member_no || encodeURIComponent(m.email);
                  return (
                  <tr key={m.email} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      <Link href={`/admin/members/${slug}`} className="hover:text-[#10B8D9] hover:underline">
                        {m.member_no || '-'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">
                      <Link href={`/admin/members/${slug}`} className="hover:underline">
                        {m.name || '-'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[220px]">
                      <Link href={`/admin/members/${slug}`} className="block truncate hover:underline" title={m.email}>
                        {m.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[m.status]}`}>
                        {STATUS_LABELS_ZH[m.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIER_BADGE_CLASSES[m.tier]}`}>
                        {TIER_LABELS_ZH[m.tier]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {m.highest_ticket_tier ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TICKET_TIER_BADGE_CLASSES[m.highest_ticket_tier]}`}>
                          {TICKET_TIER_LABELS[m.highest_ticket_tier]}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">{m.paid_order_count}</td>
                    <td className="px-4 py-3 text-right text-slate-900 font-mono whitespace-nowrap">
                      {m.total_spent_cents > 0 ? formatAmount(m.total_spent_cents, m.currency) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-mono">{m.score}</td>
                    <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                      {formatDate(m.last_interaction_at)}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
