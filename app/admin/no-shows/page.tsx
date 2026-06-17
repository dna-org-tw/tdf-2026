'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/basePath';
import {
  TICKET_TIER_LABELS,
  TICKET_TIER_BADGE_CLASSES,
  type TicketTier,
} from '@/lib/members';

interface NoShowEntry {
  event_api_id: string;
  event_name: string;
  event_url: string | null;
  end_at: string | null;
  consumed: boolean;
  penalty_event_api_id: string | null;
  penalty_event_name: string | null;
  penalty_event_url: string | null;
  penalty_at: string | null;
}

interface PenaltyEntry {
  event_api_id: string;
  event_name: string;
  event_url: string | null;
  consumed_no_show_event_api_id: string | null;
  consumed_no_show_event_name: string | null;
  consumed_no_show_event_url: string | null;
  created_at: string;
}

interface EmailRow {
  email: string;
  member: {
    id: number;
    member_no: string;
    name: string | null;
    status: string;
    highest_ticket_tier: string | null;
    score: number;
  } | null;
  no_show_count: number;
  consumed_count: number;
  pending_count: number;
  last_no_show_at: string | null;
  no_shows: NoShowEntry[];
  penalties: PenaltyEntry[];
}

interface ApiResp {
  generatedAt: string;
  totals: {
    affectedEmails: number;
    totalNoShows: number;
    totalConsumed: number;
    totalPending: number;
  };
  rows: EmailRow[];
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Taipei',
  });
}

function fmtDateOnly(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    timeZone: 'Asia/Taipei',
  });
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-slate-900 font-semibold text-2xl tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="text-slate-400 text-xs">—</span>;
  const t = tier as TicketTier;
  const label = TICKET_TIER_LABELS[t] ?? tier;
  const cls = TICKET_TIER_BADGE_CLASSES[t] ?? 'bg-slate-100 text-slate-600';
  return <span className={`px-2 py-0.5 rounded-full text-xs ${cls}`}>{label}</span>;
}

const STATUS_ZH: Record<string, string> = {
  paid: '已付費',
  pending: '待付款',
  abandoned: '已放棄',
  subscriber: '訂閱',
  other: '其他',
};

export default function NoShowsPage() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch('/api/admin/no-shows');
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? `HTTP ${r.status}`);
      } else {
        setData(j as ApiResp);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (pendingOnly && r.pending_count <= 0) return false;
      if (!q) return true;
      if (r.email.toLowerCase().includes(q)) return true;
      if (r.member?.name?.toLowerCase().includes(q)) return true;
      if (r.member?.member_no?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [data, search, pendingOnly]);

  const toggle = (email: string) => {
    setExpanded((cur) => (cur === email ? null : email));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">未到場與懲罰狀況</h1>
          <p className="text-sm text-slate-500">
            報名核准但未簽到（活動結束滿 4 小時）會被計為 no-show，下次報名時自動改為候補（懲罰）。
          </p>
        </div>
        <button
          onClick={load}
          className="text-sm text-slate-600 hover:text-[#10B8D9] border border-slate-300 px-3 py-1.5 rounded"
        >
          重新整理
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="受影響會員 / Email" value={data?.totals.affectedEmails ?? '—'} />
        <Kpi label="累計 no-show 次數" value={data?.totals.totalNoShows ?? '—'} />
        <Kpi label="已執行懲罰" value={data?.totals.totalConsumed ?? '—'} hint="改為候補的次數" />
        <Kpi
          label="待執行懲罰"
          value={data?.totals.totalPending ?? '—'}
          hint="尚未在後續活動消化"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 email、姓名或會員編號…"
          className="rounded border border-slate-300 px-3 py-1.5 text-sm flex-1 min-w-[240px]"
        />
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(e) => setPendingOnly(e.target.checked)}
            className="accent-[#10B8D9]"
          />
          只顯示尚有待消化
        </label>
        {data && (
          <span className="text-xs text-slate-400 ml-auto">
            共 {filtered.length} / {data.rows.length} 筆 · 更新於 {fmtDateTime(data.generatedAt)}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          載入失敗：{error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-3 py-2 font-medium text-slate-600 w-8"></th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">會員 / Email</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">身份</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">No-show</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">已消化</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">待消化</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">最近未到場活動</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-400">載入中…</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                    {data && data.rows.length > 0 ? '沒有符合條件的紀錄' : '目前沒有 no-show 紀錄'}
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const isOpen = expanded === r.email;
                return (
                  <RowGroup
                    key={r.email}
                    row={r}
                    isOpen={isOpen}
                    onToggle={() => toggle(r.email)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RowGroup({
  row,
  isOpen,
  onToggle,
}: {
  row: EmailRow;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const memberLink = row.member ? `/admin/members/${encodeURIComponent(row.member.member_no)}` : null;
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
      >
        <td className="px-3 py-2 text-slate-400 text-center">{isOpen ? '▾' : '▸'}</td>
        <td className="px-3 py-2">
          <div className="flex flex-col">
            {memberLink ? (
              <Link
                href={memberLink}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-slate-900 hover:text-[#10B8D9]"
              >
                {row.member?.name || row.email}
              </Link>
            ) : (
              <span className="font-medium text-slate-900">{row.email}</span>
            )}
            <span className="text-xs text-slate-500 font-mono">
              {row.member?.member_no && (
                <>
                  <span className="text-slate-400">{row.member.member_no} · </span>
                </>
              )}
              {row.email}
            </span>
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <TierBadge tier={row.member?.highest_ticket_tier ?? null} />
            {row.member?.status && (
              <span className="text-xs text-slate-500">
                {STATUS_ZH[row.member.status] ?? row.member.status}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">
          {row.no_show_count}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
          {row.consumed_count}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {row.pending_count > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {row.pending_count}
            </span>
          ) : (
            <span className="text-slate-400">0</span>
          )}
        </td>
        <td className="px-3 py-2">
          {(() => {
            const latest = row.no_shows.length > 0 ? row.no_shows[row.no_shows.length - 1] : null;
            if (!latest) return <span className="text-slate-400 text-xs">—</span>;
            return (
              <div className="flex flex-col min-w-0">
                {latest.event_url ? (
                  <a
                    href={latest.event_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-slate-800 hover:text-[#10B8D9] truncate inline-flex items-center gap-1"
                    title={latest.event_name}
                  >
                    <span className="truncate">{latest.event_name}</span>
                    <span className="text-slate-400 shrink-0">↗</span>
                  </a>
                ) : (
                  <span className="text-sm text-slate-800 truncate" title={latest.event_name}>{latest.event_name}</span>
                )}
                <span className="text-xs text-slate-500">
                  {fmtDateOnly(latest.end_at ?? row.last_no_show_at)}
                  {row.no_shows.length > 1 && (
                    <span className="text-slate-400"> · 共 {row.no_shows.length} 場</span>
                  )}
                </span>
              </div>
            );
          })()}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-slate-50/50">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  No-Show 活動 ({row.no_shows.length})
                </h3>
                {row.no_shows.length === 0 ? (
                  <p className="text-sm text-slate-400">無</p>
                ) : (
                  <ul className="space-y-1.5">
                    {row.no_shows.map((n) => (
                      <li
                        key={n.event_api_id}
                        className="text-sm border-l-2 pl-3 py-1 border-slate-300 bg-white rounded-r"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            {n.event_url ? (
                              <a
                                href={n.event_url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-slate-800 hover:text-[#10B8D9] break-words inline-flex items-baseline gap-1"
                              >
                                <span>{n.event_name}</span>
                                <span className="text-slate-400 text-xs">↗</span>
                              </a>
                            ) : (
                              <span className="font-medium text-slate-800">{n.event_name}</span>
                            )}
                            <div className="text-xs text-slate-500 mt-0.5">
                              結束於 {fmtDateTime(n.end_at)}
                            </div>
                          </div>
                          {n.consumed ? (
                            <span
                              className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700 shrink-0"
                              title={
                                n.penalty_event_name
                                  ? `已在 "${n.penalty_event_name}" 消化（${fmtDateTime(n.penalty_at)}）`
                                  : '已消化'
                              }
                            >
                              已消化
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 shrink-0">
                              待消化
                            </span>
                          )}
                        </div>
                        {n.consumed && n.penalty_event_name && (
                          <div className="text-xs text-slate-500 mt-1">
                            → 罰於：{' '}
                            {n.penalty_event_url ? (
                              <a
                                href={n.penalty_event_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-700 hover:text-[#10B8D9] inline-flex items-baseline gap-0.5"
                              >
                                <span>{n.penalty_event_name}</span>
                                <span className="text-slate-400">↗</span>
                              </a>
                            ) : (
                              <span className="text-slate-700">{n.penalty_event_name}</span>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  懲罰紀錄 ({row.penalties.length})
                </h3>
                {row.penalties.length === 0 ? (
                  <p className="text-sm text-slate-400">無</p>
                ) : (
                  <ul className="space-y-1.5">
                    {row.penalties.map((p) => (
                      <li
                        key={p.event_api_id + p.created_at}
                        className="text-sm border-l-2 pl-3 py-1 border-amber-300 bg-white rounded-r"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            {p.event_url ? (
                              <a
                                href={p.event_url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-slate-800 hover:text-[#10B8D9] break-words inline-flex items-baseline gap-1"
                              >
                                <span>{p.event_name}</span>
                                <span className="text-slate-400 text-xs">↗</span>
                              </a>
                            ) : (
                              <span className="font-medium text-slate-800">{p.event_name}</span>
                            )}
                            <div className="text-xs text-slate-500 mt-0.5">
                              改為候補：{fmtDateTime(p.created_at)}
                            </div>
                          </div>
                        </div>
                        {p.consumed_no_show_event_name && (
                          <div className="text-xs text-slate-500 mt-1">
                            消化來源：{' '}
                            {p.consumed_no_show_event_url ? (
                              <a
                                href={p.consumed_no_show_event_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-700 hover:text-[#10B8D9] inline-flex items-baseline gap-0.5"
                              >
                                <span>{p.consumed_no_show_event_name}</span>
                                <span className="text-slate-400">↗</span>
                              </a>
                            ) : (
                              <span className="text-slate-700">{p.consumed_no_show_event_name}</span>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
