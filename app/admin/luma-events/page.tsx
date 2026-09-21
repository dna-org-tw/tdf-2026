'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/basePath';

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
  requires_confirmation: boolean;
  standard_ticket_price_twd: number | null;
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

interface ProfileBreakdownItem {
  label: string;
  count: number;
}

interface ProfileBreakdown {
  approved: ProfileBreakdownItem[];
  all: ProfileBreakdownItem[];
}

interface ProfileStats {
  totals: { approved: number; all: number };
  ticketTier: ProfileBreakdown;
  nationality: ProfileBreakdown;
  workTypes: ProfileBreakdown;
  nomadExperience: ProfileBreakdown;
  profileCompletion: ProfileBreakdown;
}

interface DetailResponse {
  event: { event_api_id: string; name: string; start_at: string | null; end_at: string | null; url: string | null; capacity: number | null };
  pivot: PivotRow[];
  guests: GuestRow[];
  profile_stats?: ProfileStats;
}

const TIER_LABEL: Record<string, string> = {
  backer: 'Backer 贊助者',
  weekly_backer: 'Weekly Backer 週支持',
  contribute: 'Contribute 響應者',
  explore: 'Explore 探索者',
  none: '未購票',
};

const TIER_CLASS: Record<string, string> = {
  backer: 'bg-purple-500',
  weekly_backer: 'bg-fuchsia-500',
  contribute: 'bg-blue-500',
  explore: 'bg-sky-400',
  none: 'bg-slate-300',
};

const WORK_TYPE_LABEL: Record<string, string> = {
  admin_mgmt: '行政管理',
  sales_marketing: '業務行銷',
  finance_legal: '財金法務',
  it_engineering: '資訊工程',
  design_creative: '設計創意',
  education_research: '教育研究',
  healthcare_social: '醫療社福',
  tourism_hospitality: '旅遊餐旅',
  manufacturing_logistics: '製造物流',
  freelance_entrepreneur: '自由工作 / 創業',
  __unknown__: '未填寫',
};

const NOMAD_EXP_LABEL: Record<string, string> = {
  not_yet: '尚未開始',
  under_3m: '< 3 個月',
  '3m_to_1y': '3 個月 ~ 1 年',
  '1_to_3y': '1 ~ 3 年',
  '3_to_5y': '3 ~ 5 年',
  '5_to_10y': '5 ~ 10 年',
  over_10y: '> 10 年',
  __unknown__: '未填寫',
};

const COMPLETION_LABEL: Record<string, string> = {
  complete: '完整',
  partial: '部分填寫',
  none: '未填寫',
};

const COMPLETION_CLASS: Record<string, string> = {
  complete: 'bg-emerald-500',
  partial: 'bg-amber-400',
  none: 'bg-slate-300',
};

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
      const r = await apiFetch('/api/admin/luma-events');
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
      const r = await apiFetch(`/api/admin/luma-events?eventApiId=${encodeURIComponent(eventApiId)}`);
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
      if (!showPast) {
        const endMs = e.end_at
          ? new Date(e.end_at).getTime()
          : e.start_at
          ? new Date(e.start_at).getTime() + 24 * 60 * 60 * 1000
          : null;
        if (endMs !== null && endMs < now) return false;
      }
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

  // Optimistic toggle for the confirmation-mechanism flag. On failure we
  // refetch the list so the UI re-syncs with the actual DB state instead
  // of staying on the optimistic value.
  const onToggleRequiresConfirmation = useCallback(async (eventApiId: string, next: boolean) => {
    setEvents((prev) =>
      prev ? prev.map((e) => (e.event_api_id === eventApiId ? { ...e, requires_confirmation: next } : e)) : prev,
    );
    try {
      const r = await apiFetch(`/api/admin/luma-events?eventApiId=${encodeURIComponent(eventApiId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requires_confirmation: next }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      console.error('toggle requires_confirmation failed:', e);
      fetchList();
    }
  }, [fetchList]);

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
                <th className="px-3 py-2 text-center" title="開啟後：未確認者於 cutoff 後自動降為 waitlist，已確認但未到場者扣 Standard Ticket 票價">
                  擔保確認
                </th>
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
                    onToggleRequiresConfirmation={onToggleRequiresConfirmation}
                  />
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
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
  onToggleRequiresConfirmation,
}: {
  e: EventListRow;
  isOpen: boolean;
  onToggle: () => void;
  detail: DetailResponse | null;
  detailLoading: boolean;
  filteredGuests: GuestRow[];
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  onToggleRequiresConfirmation: (eventApiId: string, next: boolean) => void;
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
        <td className="px-3 py-2 text-center" onClick={(ev) => ev.stopPropagation()}>
          <RequiresConfirmationToggle
            checked={e.requires_confirmation}
            priceTwd={e.standard_ticket_price_twd}
            onChange={(next) => onToggleRequiresConfirmation(e.event_api_id, next)}
          />
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={7} className="bg-slate-50 px-3 py-3">
            {detailLoading && <div className="text-xs text-slate-500">載入詳細…</div>}
            {detail && (
              <div className="space-y-4">
                <PivotTable pivot={detail.pivot} />
                {detail.profile_stats && <ProfileStatsPanel stats={detail.profile_stats} />}
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

function RequiresConfirmationToggle({
  checked,
  priceTwd,
  onChange,
}: {
  checked: boolean;
  priceTwd: number | null;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer"
      />
      <span className="text-xs text-slate-500 tabular-nums">
        {checked
          ? priceTwd && priceTwd > 0
            ? `NT$${priceTwd}`
            : '免費'
          : '—'}
      </span>
    </label>
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

function ProfileStatsPanel({ stats }: { stats: ProfileStats }) {
  const [scope, setScope] = useState<'approved' | 'all'>('approved');
  const denom = scope === 'approved' ? stats.totals.approved : stats.totals.all;

  return (
    <div className="rounded border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">參與者輪廓</span>
          <span className="text-slate-500">
            （核准 {stats.totals.approved}・全部 {stats.totals.all}）
          </span>
        </div>
        <div className="flex gap-1">
          <FilterBtn
            label={`核准 ${stats.totals.approved}`}
            active={scope === 'approved'}
            onClick={() => setScope('approved')}
          />
          <FilterBtn
            label={`全部 ${stats.totals.all}`}
            active={scope === 'all'}
            onClick={() => setScope('all')}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-3 md:grid-cols-2">
        <BreakdownChart
          title="會員票券等級"
          items={stats.ticketTier[scope]}
          denom={denom}
          labelMap={TIER_LABEL}
          colorMap={TIER_CLASS}
        />
        <BreakdownChart
          title="資料完整度"
          items={stats.profileCompletion[scope]}
          denom={denom}
          labelMap={COMPLETION_LABEL}
          colorMap={COMPLETION_CLASS}
        />
        <BreakdownChart
          title="國籍 / 地區"
          items={stats.nationality[scope]}
          denom={denom}
          labelMap={{ __other__: '其他', __unknown__: '未填寫' }}
          color="bg-teal-500"
        />
        <BreakdownChart
          title="工作類型 (可複選)"
          items={stats.workTypes[scope]}
          denom={denom}
          labelMap={WORK_TYPE_LABEL}
          color="bg-indigo-500"
          note="同一人可選多項，故總和可能超過樣本數。"
        />
        <BreakdownChart
          title="數位遊牧資歷"
          items={stats.nomadExperience[scope]}
          denom={denom}
          labelMap={NOMAD_EXP_LABEL}
          color="bg-rose-500"
          className="md:col-span-2"
        />
      </div>
    </div>
  );
}

function BreakdownChart({
  title,
  items,
  denom,
  labelMap,
  colorMap,
  color,
  note,
  className,
}: {
  title: string;
  items: ProfileBreakdownItem[];
  denom: number;
  labelMap?: Record<string, string>;
  colorMap?: Record<string, string>;
  color?: string;
  note?: string;
  className?: string;
}) {
  const max = items.reduce((m, it) => Math.max(m, it.count), 0);
  const widthFor = (n: number) => (max > 0 ? Math.max(2, (n / max) * 100) : 0);
  return (
    <div className={className}>
      <div className="mb-1.5 text-xs font-medium text-slate-700">{title}</div>
      {items.length === 0 ? (
        <div className="text-[11px] text-slate-400">無資料</div>
      ) : (
        <div className="space-y-1">
          {items.map((it) => {
            const label = labelMap?.[it.label] ?? it.label;
            const pct = denom > 0 ? Math.round((it.count / denom) * 100) : 0;
            const cls = colorMap?.[it.label] ?? color ?? 'bg-slate-400';
            return (
              <div key={it.label} className="flex items-center gap-2 text-[11px]">
                <div className="w-28 truncate text-slate-600" title={label}>
                  {label}
                </div>
                <div className="relative flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-3 ${cls}`}
                    style={{ width: `${widthFor(it.count)}%` }}
                  />
                </div>
                <div className="w-16 text-right tabular-nums text-slate-700">
                  {it.count}
                  <span className="ml-1 text-slate-400">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {note && <div className="mt-1.5 text-[10px] text-slate-400">{note}</div>}
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
