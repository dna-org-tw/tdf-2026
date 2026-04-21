'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import type { UnifiedEvent, AuditSource, ActorType } from '@/lib/adminAuditing';

const SOURCE_LABELS: Record<AuditSource, string> = {
  order_action: '訂單操作',
  order_transfer: '訂單轉讓',
  visa_letter: '簽證信',
};

const SOURCE_BADGE: Record<AuditSource, string> = {
  order_action: 'bg-sky-100 text-sky-700',
  order_transfer: 'bg-amber-100 text-amber-700',
  visa_letter: 'bg-violet-100 text-violet-700',
};

const ACTOR_BADGE: Record<ActorType, string> = {
  admin: 'bg-emerald-100 text-emerald-700',
  user: 'bg-slate-100 text-slate-700',
  system: 'bg-slate-200 text-slate-600',
};

const ALL_SOURCES: AuditSource[] = ['order_action', 'order_transfer', 'visa_letter'];

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Taipei',
  });
}

export default function AdminAuditingPage() {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000);

  const [fromDate, setFromDate] = useState(toDateInput(sevenDaysAgo));
  const [toDate, setToDate] = useState(toDateInput(today));
  const [sources, setSources] = useState<Set<AuditSource>>(new Set(ALL_SOURCES));
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');

  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchEvents = useCallback(
    async (opts: { append?: boolean; toOverride?: string } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('from', new Date(`${fromDate}T00:00:00+08:00`).toISOString());
        params.set(
          'to',
          opts.toOverride ?? new Date(`${toDate}T23:59:59+08:00`).toISOString(),
        );
        if (sources.size && sources.size < ALL_SOURCES.length) {
          params.set('source', [...sources].join(','));
        }
        if (actor.trim()) params.set('actor', actor.trim());
        if (action.trim()) params.set('action', action.trim());
        if (q.trim()) params.set('q', q.trim());
        params.set('limit', '100');

        const res = await fetch(`/api/admin/auditing?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          events: UnifiedEvent[];
          hasMore: boolean;
        };
        setEvents((prev) => (opts.append ? [...prev, ...data.events] : data.events));
        setHasMore(data.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch');
      } finally {
        setLoading(false);
      }
    },
    [fromDate, toDate, sources, actor, action, q],
  );

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSource = (s: AuditSource) => {
    setSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next.size === 0 ? new Set(ALL_SOURCES) : next;
    });
  };

  const loadMore = () => {
    const oldest = events[events.length - 1];
    if (!oldest) return;
    fetchEvents({ append: true, toOverride: oldest.at });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">稽核軌跡</h1>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex flex-col text-xs text-slate-600">
            起始日期
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            結束日期
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            Actor（email 子字串）
            <input
              type="text"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              placeholder="例：alice@dna"
              className="mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            動作（精確）
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="例：refund / transfer"
              className="mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-600 lg:col-span-3">
            搜尋（resource id / summary 子字串）
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={() => fetchEvents()}
              disabled={loading}
              className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-2 rounded text-sm"
            >
              {loading ? '載入中…' : '套用'}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ALL_SOURCES.map((s) => (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className={`px-2 py-1 rounded text-xs font-medium ${
                sources.has(s)
                  ? SOURCE_BADGE[s]
                  : 'bg-slate-50 text-slate-400 border border-slate-200'
              }`}
            >
              {SOURCE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 mb-4 text-sm">
          {error}
          <button
            onClick={() => fetchEvents()}
            className="ml-3 underline hover:no-underline"
          >
            重試
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">時間</th>
              <th className="px-3 py-2 text-left">來源</th>
              <th className="px-3 py-2 text-left">操作人</th>
              <th className="px-3 py-2 text-left">動作</th>
              <th className="px-3 py-2 text-left">對象</th>
              <th className="px-3 py-2 text-left">狀態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  在此區間沒有稽核紀錄
                </td>
              </tr>
            )}
            {events.map((ev) => {
              const isOpen = expanded === ev.id;
              const failed = ev.status === 'failed';
              return (
                <Fragment key={ev.id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : ev.id)}
                    className={`cursor-pointer hover:bg-slate-50 ${
                      failed ? 'border-l-4 border-red-500' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-slate-700 font-mono text-xs whitespace-nowrap">
                      {formatTime(ev.at)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${SOURCE_BADGE[ev.source]}`}>
                        {SOURCE_LABELS[ev.source]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <span className={`mr-2 px-1.5 py-0.5 rounded text-[10px] ${ACTOR_BADGE[ev.actorType]}`}>
                        {ev.actorType}
                      </span>
                      {ev.actor}
                    </td>
                    <td className="px-3 py-2 text-slate-700 font-mono text-xs">{ev.action}</td>
                    <td className="px-3 py-2">
                      {ev.resourceLink ? (
                        <a
                          href={ev.resourceLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-sky-600 hover:underline"
                        >
                          {ev.resourceLabel}
                        </a>
                      ) : (
                        <span className="text-slate-700">{ev.resourceLabel}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {ev.status === 'success' && <span className="text-emerald-600">✓</span>}
                      {ev.status === 'failed' && <span className="text-red-600">✗ 失敗</span>}
                      {ev.status === null && <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-3 py-3">
                        <div className="text-xs text-slate-600 mb-2">{ev.summary}</div>
                        {ev.source === 'order_transfer' && (
                          <TransferExtras payload={ev.payload} />
                        )}
                        <pre className="bg-white border border-slate-200 rounded p-3 text-xs text-slate-800 overflow-x-auto">
                          {JSON.stringify(ev.payload, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        <div className="border-t border-slate-100 px-3 py-3 text-center">
          {hasMore ? (
            <button
              onClick={loadMore}
              disabled={loading}
              className="text-sm text-sky-600 hover:underline disabled:opacity-50"
            >
              {loading ? '載入中…' : '載入更多'}
            </button>
          ) : (
            events.length > 0 && (
              <span className="text-xs text-slate-400">沒有更多紀錄了</span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function TransferExtras({ payload }: { payload: unknown }) {
  const p = payload as { ip_address?: string | null; user_agent?: string | null };
  if (!p || (!p.ip_address && !p.user_agent)) return null;
  return (
    <div className="mb-2 text-xs text-slate-600 flex flex-wrap gap-x-4">
      {p.ip_address && <span>IP: <code className="text-slate-800">{p.ip_address}</code></span>}
      {p.user_agent && (
        <span className="truncate max-w-[60%]">UA: <code className="text-slate-800">{p.user_agent}</code></span>
      )}
    </div>
  );
}
