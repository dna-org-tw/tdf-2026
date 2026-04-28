'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface StatusCounts {
  approved: number;
  waitlist: number;
  invited: number;
  declined: number;
  other: number;
  total: number;
  paid: number;
  checkedIn: number;
}

interface EventListRow {
  event_api_id: string;
  name: string;
  start_at: string | null;
  end_at: string | null;
  url: string | null;
  capacity: number | null;
  counts: StatusCounts;
}

interface PivotRow {
  ticket_type_name: string;
  counts: StatusCounts;
}

interface GuestRow {
  email: string;
  ticket_type_name: string | null;
  activity_status: string | null;
  paid: boolean;
  checked_in_at: string | null;
  registered_at: string | null;
  luma_guest_api_id: string | null;
  latest_reason: string | null;
}

interface DetailResponse {
  event: { event_api_id: string; name: string; start_at: string | null; end_at: string | null; url: string | null; capacity: number | null };
  pivot: PivotRow[];
  guests: GuestRow[];
}

const STATUS_BADGE: Record<string, string> = {
  approved: 'bg-green-100 text-green-800',
  waitlist: 'bg-amber-100 text-amber-800',
  invited: 'bg-slate-200 text-slate-700',
  declined: 'bg-red-100 text-red-800',
  other: 'bg-slate-100 text-slate-600',
  pending_approval: 'bg-blue-100 text-blue-800',
  going: 'bg-green-100 text-green-800',
};

const STATUS_LABEL: Record<string, string> = {
  approved: '核准',
  waitlist: '候補',
  invited: '已邀請',
  declined: '拒絕',
  other: '其他',
  pending_approval: '審核中',
  going: '已報名',
};

function fmtDate(iso: string | null) {
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

export default function LumaEventsPage() {
  const [events, setEvents] = useState<EventListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchList = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/luma-events');
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? `HTTP ${r.status}`);
      } else {
        setEvents(data.events as EventListRow[]);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const fetchDetail = useCallback(async (eventApiId: string) => {
    setDetailLoading(true);
    setDetail(null);
    setStatusFilter('all');
    try {
      const r = await fetch(`/api/admin/luma-events?eventApiId=${encodeURIComponent(eventApiId)}`);
      const data = await r.json();
      if (r.ok) setDetail(data as DetailResponse);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const filtered = useMemo(() => {
    if (!events) return [];
    const now = Date.now();
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (!showPast && e.start_at && new Date(e.start_at).getTime() < now - 24 * 60 * 60 * 1000) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, search, showPast]);

  const filteredGuests = useMemo(() => {
    if (!detail) return [];
    if (statusFilter === 'all') return detail.guests;
    return detail.guests.filter((g) => (g.activity_status ?? 'other') === statusFilter);
  }, [detail, statusFilter]);

  const onToggle = (eventApiId: string) => {
    if (expanded === eventApiId) {
      setExpanded(null);
      setDetail(null);
    } else {
      setExpanded(eventApiId);
      fetchDetail(eventApiId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">活動報名</h1>
          <p className="text-sm text-slate-500">每個 Luma 活動的票券種類 × 報名狀態統計與名單。</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋活動名稱…"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm w-56"
          />
          <label className="flex items-center gap-1.5 text-slate-600">
            <input
              type="checkbox"
              checked={showPast}
              onChange={(e) => setShowPast(e.target.checked)}
            />
            含已結束
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          載入失敗：{error}
        </div>
      )}

      {!events && !error && <div className="text-sm text-slate-500">載入中…</div>}

      {events && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">日期</th>
                <th className="px-3 py-2">活動名稱</th>
                <th className="px-3 py-2 text-right">核准 / 上限</th>
                <th className="px-3 py-2 text-right">總人數</th>
                <th className="px-3 py-2">狀態分布</th>
                <th className="px-3 py-2 text-right">已 check-in</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const isOpen = expanded === e.event_api_id;
                return (
                  <FragmentRow
                    key={e.event_api_id}
                    e={e}
                    isOpen={isOpen}
                    onToggle={() => onToggle(e.event_api_id)}
                    detail={isOpen ? detail : null}
                    detailLoading={isOpen && detailLoading}
                    filteredGuests={isOpen ? filteredGuests : []}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                  />
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                    沒有符合條件的活動。
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

function FragmentRow({
  e,
  isOpen,
  onToggle,
  detail,
  detailLoading,
  filteredGuests,
  statusFilter,
  setStatusFilter,
}: {
  e: EventListRow;
  isOpen: boolean;
  onToggle: () => void;
  detail: DetailResponse | null;
  detailLoading: boolean;
  filteredGuests: GuestRow[];
  statusFilter: string;
  setStatusFilter: (s: string) => void;
}) {
  return (
    <>
      <tr
        className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${isOpen ? 'bg-slate-50' : ''}`}
        onClick={onToggle}
      >
        <td className="px-3 py-2 whitespace-nowrap text-slate-600">{fmtDateOnly(e.start_at)}</td>
        <td className="px-3 py-2">
          <div className="font-medium text-slate-900">{e.name}</div>
          {e.url && (
            <a
              href={e.url}
              target="_blank"
              rel="noreferrer"
              onClick={(ev) => ev.stopPropagation()}
              className="text-xs text-[#10B8D9] hover:underline"
            >
              Luma 頁面 ↗
            </a>
          )}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          <CapacityCell approved={e.counts.approved} capacity={e.capacity} />
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{e.counts.total}</td>
        <td className="px-3 py-2">
          <StatusBar counts={e.counts} />
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{e.counts.checkedIn}</td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={6} className="bg-slate-50 px-3 py-3">
            {detailLoading && <div className="text-xs text-slate-500">載入詳細…</div>}
            {detail && (
              <div className="space-y-4">
                <PivotTable pivot={detail.pivot} />
                <GuestList
                  guests={filteredGuests}
                  total={detail.guests.length}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  allStatuses={Array.from(new Set(detail.guests.map((g) => g.activity_status ?? 'other')))}
                />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function CapacityCell({ approved, capacity }: { approved: number; capacity: number | null }) {
  if (capacity === null) {
    return <span className="text-slate-400">{approved} / ∞</span>;
  }
  const ratio = capacity > 0 ? approved / capacity : 0;
  const cls = ratio >= 1 ? 'text-red-700 font-semibold' : ratio >= 0.85 ? 'text-amber-700' : 'text-slate-700';
  return (
    <span className={cls}>
      {approved} / {capacity}
    </span>
  );
}

function StatusBar({ counts }: { counts: StatusCounts }) {
  const items: Array<{ key: keyof StatusCounts; label: string; cls: string }> = [
    { key: 'approved', label: '核准', cls: 'bg-green-500' },
    { key: 'waitlist', label: '候補', cls: 'bg-amber-500' },
    { key: 'invited', label: '已邀請', cls: 'bg-slate-400' },
    { key: 'declined', label: '拒絕', cls: 'bg-red-500' },
    { key: 'other', label: '其他', cls: 'bg-slate-300' },
  ];
  const total = counts.total || 1;
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 w-32 overflow-hidden rounded-full bg-slate-100">
        {items.map((it) => {
          const v = counts[it.key];
          if (!v) return null;
          return <div key={it.key} className={it.cls} style={{ width: `${(v / total) * 100}%` }} />;
        })}
      </div>
      <div className="flex flex-wrap gap-1 text-[10px]">
        {items
          .filter((it) => counts[it.key] > 0)
          .map((it) => (
            <span
              key={it.key}
              className={`rounded px-1.5 py-0.5 ${STATUS_BADGE[it.key] ?? 'bg-slate-100 text-slate-600'}`}
            >
              {it.label} {counts[it.key]}
            </span>
          ))}
      </div>
    </div>
  );
}

function PivotTable({ pivot }: { pivot: PivotRow[] }) {
  return (
    <div className="rounded border border-slate-200 bg-white">
      <table className="w-full text-xs">
        <thead className="border-b border-slate-200 text-left text-slate-500">
          <tr>
            <th className="px-2 py-1.5">票種</th>
            <th className="px-2 py-1.5 text-right">總人數</th>
            <th className="px-2 py-1.5 text-right">核准</th>
            <th className="px-2 py-1.5 text-right">候補</th>
            <th className="px-2 py-1.5 text-right">已邀請</th>
            <th className="px-2 py-1.5 text-right">拒絕</th>
            <th className="px-2 py-1.5 text-right">其他</th>
            <th className="px-2 py-1.5 text-right">已付</th>
            <th className="px-2 py-1.5 text-right">已 check-in</th>
          </tr>
        </thead>
        <tbody>
          {pivot.map((p) => (
            <tr key={p.ticket_type_name} className="border-b border-slate-100 last:border-b-0">
              <td className="px-2 py-1.5 font-medium text-slate-800">{p.ticket_type_name}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{p.counts.total}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-green-700">{p.counts.approved}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-amber-700">{p.counts.waitlist}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{p.counts.invited}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-red-700">{p.counts.declined}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{p.counts.other}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{p.counts.paid}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{p.counts.checkedIn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuestList({
  guests,
  total,
  statusFilter,
  setStatusFilter,
  allStatuses,
}: {
  guests: GuestRow[];
  total: number;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  allStatuses: string[];
}) {
  return (
    <div className="rounded border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs">
        <span className="text-slate-500">名單 ({guests.length}/{total})</span>
        <div className="ml-auto flex flex-wrap gap-1">
          <FilterBtn label={`全部 ${total}`} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
          {allStatuses.map((s) => (
            <FilterBtn
              key={s}
              label={STATUS_LABEL[s] ?? s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              cls={STATUS_BADGE[s]}
            />
          ))}
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white text-left text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-2 py-1.5">Email</th>
              <th className="px-2 py-1.5">票種</th>
              <th className="px-2 py-1.5">狀態</th>
              <th className="px-2 py-1.5">最近原因</th>
              <th className="px-2 py-1.5">報名時間</th>
              <th className="px-2 py-1.5">Check-in</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <tr key={g.email + g.luma_guest_api_id} className="border-b border-slate-100 last:border-b-0">
                <td className="px-2 py-1.5 font-mono text-slate-800">{g.email}</td>
                <td className="px-2 py-1.5 text-slate-700">{g.ticket_type_name ?? '—'}</td>
                <td className="px-2 py-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      STATUS_BADGE[g.activity_status ?? 'other'] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {STATUS_LABEL[g.activity_status ?? 'other'] ?? g.activity_status ?? '—'}
                  </span>
                  {g.paid && (
                    <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">已付</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-slate-500" title={g.latest_reason ?? undefined}>
                  {g.latest_reason ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{fmtDate(g.registered_at)}</td>
                <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                  {g.checked_in_at ? fmtDate(g.checked_in_at) : '—'}
                </td>
              </tr>
            ))}
            {guests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-3 text-center text-slate-500">
                  此狀態無報名者。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterBtn({ label, active, onClick, cls }: { label: string; active: boolean; onClick: () => void; cls?: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : cls ?? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
