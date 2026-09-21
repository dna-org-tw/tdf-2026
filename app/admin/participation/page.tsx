'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/basePath';

interface ParticipantEvent {
  event_api_id: string;
  name: string;
  start_at: string | null;
  end_at: string | null;
  url: string | null;
  activity_status: string | null;
  paid: boolean;
  checked_in_at: string | null;
  registered_at: string | null;
  ticket_type_name: string | null;
}

interface Participant {
  email: string;
  name: string | null;
  member_no: string | null;
  event_count: number;
  approved_count: number;
  checked_in_count: number;
  events: ParticipantEvent[];
}

interface Summary {
  totalParticipants: number;
  totalRegistrations: number;
  avgEventsPerPerson: number;
  eventsConsidered: number;
  mode: 'active' | 'all' | 'checked_in';
  includePast: boolean;
}

interface ApiResponse {
  participants: Participant[];
  summary: Summary;
}

type Mode = 'active' | 'all' | 'checked_in';

const MODE_LABEL: Record<Mode, string> = {
  active: '已核准 / 已報名',
  all: '全部報名（含候補、拒絕等）',
  checked_in: '只計已 check-in',
};

const STATUS_LABEL: Record<string, string> = {
  approved: '核准',
  waitlist: '候補',
  invited: '已邀請',
  declined: '拒絕',
  going: '已報名',
  pending_approval: '審核中',
};

const STATUS_BADGE: Record<string, string> = {
  approved: 'bg-green-100 text-green-800',
  waitlist: 'bg-amber-100 text-amber-800',
  invited: 'bg-slate-200 text-slate-700',
  declined: 'bg-red-100 text-red-800',
  going: 'bg-green-100 text-green-800',
  pending_approval: 'bg-blue-100 text-blue-800',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-TW', {
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

function isEventOver(e: { start_at: string | null; end_at: string | null }, now: number): boolean {
  const endMs = e.end_at
    ? new Date(e.end_at).getTime()
    : e.start_at
    ? new Date(e.start_at).getTime() + 24 * 60 * 60 * 1000
    : null;
  return endMs !== null && endMs < now;
}

export default function ParticipationPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('active');
  const [includePast, setIncludePast] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('mode', mode);
      if (!includePast) params.set('includePast', '0');
      const r = await apiFetch(`/api/admin/event-participation?${params.toString()}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      setData(json as ApiResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [mode, includePast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.participants;
    return data.participants.filter((p) => {
      if (p.email.toLowerCase().includes(q)) return true;
      if (p.name && p.name.toLowerCase().includes(q)) return true;
      if (p.member_no && p.member_no.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [data, search]);

  const maxCount = useMemo(() => {
    if (!data || data.participants.length === 0) return 1;
    return data.participants[0].event_count;
  }, [data]);

  const toggle = (email: string) => {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(filtered.map((p) => p.email.toLowerCase())));
  };
  const collapseAll = () => setExpanded(new Set());

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">參與排行</h1>
          <p className="text-sm text-slate-500">
            依參與活動數遞減排序，點擊列展開查看每個人實際參與的活動清單。
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap justify-end">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋 email / 姓名 / 編號…"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm w-56"
          />
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {(['active', 'all', 'checked_in'] as Mode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-slate-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={includePast}
              onChange={(e) => setIncludePast(e.target.checked)}
            />
            含已結束
          </label>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="參與人數" value={data.summary.totalParticipants.toLocaleString()} />
          <SummaryCard label="報名總數" value={data.summary.totalRegistrations.toLocaleString()} />
          <SummaryCard
            label="平均活動數 / 人"
            value={data.summary.avgEventsPerPerson.toFixed(2)}
          />
          <SummaryCard
            label="納入計算的活動"
            value={data.summary.eventsConsidered.toLocaleString()}
            sub={includePast ? '含已結束' : '僅未來 / 進行中'}
          />
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          載入失敗：{error}
        </div>
      )}

      {loading && !data && <div className="text-sm text-slate-500">載入中…</div>}

      {data && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 text-xs">
            <span className="text-slate-500">
              共 {filtered.length} 人
              {filtered.length !== data.participants.length && ` (篩選自 ${data.participants.length})`}
            </span>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="rounded px-2 py-0.5 text-[10px] bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                全部展開
              </button>
              <button
                onClick={collapseAll}
                className="rounded px-2 py-0.5 text-[10px] bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                全部收合
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 w-12 text-right">#</th>
                <th className="px-3 py-2">會員</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">活動數（已 / 待）</th>
                <th className="px-3 py-2">分布（已 / 未 / 待）</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const key = p.email.toLowerCase();
                const isOpen = expanded.has(key);
                return (
                  <ParticipantRow
                    key={key}
                    rank={i + 1}
                    p={p}
                    isOpen={isOpen}
                    onToggle={() => toggle(key)}
                    maxCount={maxCount}
                  />
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                    沒有符合條件的會員。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function ParticipantRow({
  rank,
  p,
  isOpen,
  onToggle,
  maxCount,
}: {
  rank: number;
  p: Participant;
  isOpen: boolean;
  onToggle: () => void;
  maxCount: number;
}) {
  const widthPct = maxCount > 0 ? Math.max(4, (p.event_count / maxCount) * 100) : 0;
  const now = Date.now();
  let noShowCount = 0;
  let upcomingCount = 0;
  for (const e of p.events) {
    if (e.checked_in_at) continue;
    if (isEventOver(e, now)) noShowCount += 1;
    else upcomingCount += 1;
  }
  const pastCount = p.checked_in_count + noShowCount;
  const total = p.event_count || 1;
  const checkedPct = (p.checked_in_count / total) * 100;
  const noShowPct = (noShowCount / total) * 100;
  const upcomingPct = (upcomingCount / total) * 100;
  return (
    <>
      <tr
        className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${isOpen ? 'bg-slate-50' : ''}`}
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{rank}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900">{p.name ?? p.email}</span>
            {p.name && (
              <span className="font-mono text-xs text-slate-500">{p.email}</span>
            )}
            {p.member_no && (
              <Link
                href={`/admin/members/${encodeURIComponent(p.member_no)}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {p.member_no} ↗
              </Link>
            )}
          </div>
        </td>
        <td
          className="px-3 py-2 text-right tabular-nums whitespace-nowrap"
          title="總活動數（已舉辦 / 待舉辦）"
        >
          <span className="font-semibold text-slate-900">{p.event_count}</span>
          <span className="ml-1 text-xs text-slate-400">
            (<span className="text-slate-600">{pastCount}</span>
            <span> / </span>
            <span className={upcomingCount > 0 ? 'text-slate-600' : 'text-slate-400'}>
              {upcomingCount}
            </span>
            )
          </span>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <div
              className="flex h-2 w-32 overflow-hidden rounded-full bg-slate-100"
              style={{ maxWidth: `${widthPct}%`, minWidth: widthPct > 0 ? 8 : 0 }}
              title="已 check-in / 未到場 / 待舉辦"
            >
              {checkedPct > 0 && (
                <div className="h-2 bg-emerald-500" style={{ width: `${checkedPct}%` }} />
              )}
              {noShowPct > 0 && (
                <div className="h-2 bg-rose-400" style={{ width: `${noShowPct}%` }} />
              )}
              {upcomingPct > 0 && (
                <div className="h-2 bg-slate-300" style={{ width: `${upcomingPct}%` }} />
              )}
            </div>
            <div className="flex flex-wrap gap-1 text-[10px]">
              {p.checked_in_count > 0 && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">
                  已 {p.checked_in_count}
                </span>
              )}
              {noShowCount > 0 && (
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-800">
                  未 {noShowCount}
                </span>
              )}
              {upcomingCount > 0 && (
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700">
                  待 {upcomingCount}
                </span>
              )}
            </div>
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={4} className="bg-slate-50 px-3 py-3">
            <div className="rounded border border-slate-200 bg-white">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-200 text-left text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5">日期</th>
                    <th className="px-2 py-1.5">活動</th>
                    <th className="px-2 py-1.5">票種</th>
                    <th className="px-2 py-1.5">狀態</th>
                    <th className="px-2 py-1.5">Check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {p.events.map((e) => (
                    <tr
                      key={e.event_api_id}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">
                        {fmtDateOnly(e.start_at)}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-medium text-slate-800">{e.name}</div>
                        {e.url && (
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(ev) => ev.stopPropagation()}
                            className="text-[10px] text-[#10B8D9] hover:underline"
                          >
                            Luma 頁面 ↗
                          </a>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-slate-700">
                        {e.ticket_type_name ?? '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            STATUS_BADGE[e.activity_status ?? ''] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {STATUS_LABEL[e.activity_status ?? ''] ?? e.activity_status ?? '—'}
                        </span>
                        {e.paid && (
                          <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                            已付
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {e.checked_in_at ? (
                          <>
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                              ✓ 已 check-in
                            </span>
                            <span className="ml-1.5 text-slate-500">{fmtDate(e.checked_in_at)}</span>
                          </>
                        ) : isEventOver(e, now) ? (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-800">
                            未到場
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            待舉辦
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
