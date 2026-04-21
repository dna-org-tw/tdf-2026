'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import type { SyncJob, SyncEventResult, SyncConfigPublic } from '@/lib/lumaSyncTypes';

export default function LumaSyncPage() {
  const [config, setConfig] = useState<SyncConfigPublic | null>(null);
  const [current, setCurrent] = useState<SyncJob | null>(null);
  const [recent, setRecent] = useState<SyncJob[]>([]);
  const [results, setResults] = useState<SyncEventResult[]>([]);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [expandedResults, setExpandedResults] = useState<SyncEventResult[]>([]);
  const [editingCookie, setEditingCookie] = useState(false);
  const [cookieDraft, setCookieDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<
    | { kind: 'ok'; entryCount: number }
    | { kind: 'invalid'; status?: number }
    | { kind: 'error'; message: string }
    | null
  >(null);
  const [testing, setTesting] = useState(false);
  const [triggeringCron, setTriggeringCron] = useState(false);
  const [triggerResult, setTriggerResult] = useState<
    | { kind: 'ok'; jobId?: number; message?: string }
    | { kind: 'error'; message: string }
    | null
  >(null);

  const fetchConfig = useCallback(async () => {
    const r = await fetch('/api/admin/luma-sync/config');
    if (r.ok) {
      const c = (await r.json()) as SyncConfigPublic;
      setConfig(c);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    const r = await fetch('/api/admin/luma-sync/jobs');
    if (r.ok) {
      const data = (await r.json()) as { current: SyncJob | null; recent: SyncJob[] };
      setCurrent(data.current);
      setRecent(data.recent);
    }
  }, []);

  const fetchCurrentResults = useCallback(async (jobId: number) => {
    const r = await fetch(`/api/admin/luma-sync/jobs/${jobId}`);
    if (r.ok) {
      const data = (await r.json()) as { results: SyncEventResult[] };
      setResults(data.results);
    }
  }, []);

  const fetchExpanded = useCallback(async (jobId: number) => {
    const r = await fetch(`/api/admin/luma-sync/jobs/${jobId}`);
    if (r.ok) {
      const data = (await r.json()) as { results: SyncEventResult[] };
      setExpandedResults(data.results);
      setExpandedJobId(jobId);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchJobs();
  }, [fetchConfig, fetchJobs]);

  useEffect(() => {
    if (!current) return;
    fetchCurrentResults(current.id);
    const interval = setInterval(() => {
      fetchJobs();
      fetchCurrentResults(current.id);
    }, 2000);
    return () => clearInterval(interval);
  }, [current, fetchCurrentResults, fetchJobs]);

  const startSync = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/admin/luma-sync/start', { method: 'POST' });
      const data = await r.json();
      if (!r.ok) setError(data.error ?? 'failed');
      await fetchJobs();
    } finally { setBusy(false); }
  };

  const testCookie = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch('/api/admin/luma-sync/test', { method: 'POST' });
      const data = await r.json();
      if (data.ok) {
        setTestResult({ kind: 'ok', entryCount: data.entryCount ?? 0 });
      } else if (data.error === 'cookie_invalid') {
        setTestResult({ kind: 'invalid', status: data.status });
      } else {
        setTestResult({ kind: 'error', message: data.error ?? `http_${r.status}` });
      }
      await fetchConfig();
    } catch (e) {
      setTestResult({ kind: 'error', message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const saveCookie = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/admin/luma-sync/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cookieDraft }),
      });
      if (!r.ok) {
        const data = await r.json();
        setError(data.error ?? 'failed');
      } else {
        setEditingCookie(false);
        setCookieDraft('');
        await fetchConfig();
      }
    } finally { setBusy(false); }
  };

  const triggerCron = async () => {
    setTriggeringCron(true);
    setTriggerResult(null);
    try {
      const r = await fetch('/api/admin/luma-sync/trigger-cron', { method: 'POST' });
      const data = await r.json();
      const upstream = data.body ?? {};
      if (r.ok && upstream.jobId) {
        setTriggerResult({ kind: 'ok', jobId: upstream.jobId });
        await fetchJobs();
      } else if (r.ok) {
        setTriggerResult({
          kind: 'ok',
          message:
            upstream.skipped === 'cron_disabled'
              ? '排程旗標關閉中（cron_enabled=false），cron 端會直接 skip。'
              : (upstream.skipped ?? JSON.stringify(upstream)),
        });
      } else {
        setTriggerResult({
          kind: 'error',
          message: `${data.error ?? `HTTP ${r.status}`} — ${upstream.message ?? upstream.error ?? ''}`.trim(),
        });
      }
    } catch (e) {
      setTriggerResult({ kind: 'error', message: (e as Error).message });
    } finally {
      setTriggeringCron(false);
    }
  };

  const toggleCron = async (enabled: boolean) => {
    await fetch('/api/admin/luma-sync/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cronEnabled: enabled }),
    });
    fetchConfig();
  };

  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('zh-TW') : '—';
  const fmtDuration = (start: string | null, end: string | null) => {
    if (!start) return '—';
    const e = end ? new Date(end).getTime() : Date.now();
    const ms = e - new Date(start).getTime();
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const statusColor = (s: string) => ({
    queued: 'bg-slate-200 text-slate-700',
    running: 'bg-blue-100 text-blue-800',
    succeeded: 'bg-green-100 text-green-800',
    partial: 'bg-amber-100 text-amber-800',
    failed: 'bg-red-100 text-red-800',
    pending: 'bg-slate-200 text-slate-700',
    done: 'bg-green-100 text-green-800',
    skipped: 'bg-slate-100 text-slate-500',
  }[s] ?? 'bg-slate-200 text-slate-700');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Luma 同步</h1>

      {config?.cookieInvalid && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-semibold">Luma session 已失效</div>
          <div className="mt-1 text-red-700">
            最近一次呼叫 Luma API 收到 401/403，請重新從瀏覽器取得 <code className="font-mono">luma.auth-session-key</code> 並更新。
          </div>
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">設定</h2>
        {config && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-28 shrink-0 text-slate-500">Session key</span>
              <span className="font-mono text-slate-700">
                {config.hasCookie ? `…${config.cookieLast4}` : '未設定'}
              </span>
              {config.cookieInvalid && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                  已失效
                </span>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  disabled={testing || !config.hasCookie}
                  onClick={testCookie}
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  {testing ? '測試中…' : '測試'}
                </button>
                <button
                  onClick={() => { setEditingCookie(true); setCookieDraft(''); }}
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                >
                  編輯
                </button>
              </div>
            </div>
            {testResult && (
              <div
                className={`rounded-md border px-3 py-2 text-xs ${
                  testResult.kind === 'ok'
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {testResult.kind === 'ok' && `測試成功，Luma 回傳 ${testResult.entryCount} 筆活動樣本。`}
                {testResult.kind === 'invalid' && `Session 已失效（HTTP ${testResult.status ?? '?'}），請重新取得 key。`}
                {testResult.kind === 'error' && `測試失敗：${testResult.message}`}
              </div>
            )}
            {editingCookie && (
              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-600">
                  登入 lu.ma calendar admin 後，DevTools → Application → Cookies → <code className="font-mono">lu.ma</code>，複製 <code className="font-mono">luma.auth-session-key</code> 的值貼上（僅需 value，不用整段 Cookie header）。
                </p>
                <textarea
                  value={cookieDraft}
                  onChange={(e) => setCookieDraft(e.target.value)}
                  placeholder="usr-xxxxxxxxxxxx"
                  className="h-20 w-full rounded border border-slate-300 p-2 font-mono text-xs"
                />
                <div className="flex gap-2">
                  <button
                    disabled={busy || cookieDraft.trim().length < 4}
                    onClick={saveCookie}
                    className="rounded-md bg-[#10B8D9] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    儲存
                  </button>
                  <button
                    onClick={() => { setEditingCookie(false); setCookieDraft(''); }}
                    className="rounded-md border border-slate-300 px-3 py-1 text-xs"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-28 shrink-0 text-slate-500">Cron</span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.cronEnabled}
                  onChange={(e) => toggleCron(e.target.checked)}
                />
                啟用排程
              </label>
              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700">
                {config.cronSchedule}
              </span>
              <a
                href="https://github.com/dna-org-tw/tdf-2026/blob/main/.github/workflows/luma-sync-cron.yml"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#10B8D9] hover:underline"
              >
                改排程 → 編輯 GitHub workflow ↗
              </a>
              <button
                onClick={triggerCron}
                disabled={triggeringCron}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                title="走和 GitHub Actions 一樣的路徑（CRON_SECRET + cron_enabled 檢查），方便手動驗證 cron 鏈路。"
              >
                {triggeringCron ? '觸發中…' : '立即觸發 cron'}
              </button>
            </div>
            <div className="text-xs text-slate-500">
              排程實際由 GitHub Actions 控制，本欄只顯示 DB 上的標籤；後台修改不會改變實際執行時間。
            </div>
            {triggerResult && (
              <div
                className={`rounded-md border px-3 py-2 text-xs ${
                  triggerResult.kind === 'ok'
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                {triggerResult.kind === 'ok' && triggerResult.jobId
                  ? `Cron 已觸發 — job #${triggerResult.jobId} 已排入。`
                  : triggerResult.kind === 'ok'
                    ? `Cron 端回應：${triggerResult.message}`
                    : `觸發失敗：${triggerResult.message}`}
              </div>
            )}
            <div className="text-xs text-slate-500">
              上次手動執行：{fmtDate(config.lastManualRunAt)} · 設定更新：{fmtDate(config.updatedAt)} ({config.updatedBy ?? '—'})
            </div>
          </div>
        )}
      </section>

      <section>
        <button
          onClick={startSync}
          disabled={busy || !!current || !config?.hasCookie}
          className="rounded-lg bg-[#10B8D9] px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          {current ? '同步進行中…' : '立即同步'}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      {current && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900 flex items-center gap-2">
            進行中 (job #{current.id})
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              current.phase === 'done' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {current.phase === 'done' ? '完成' : '同步中'}
            </span>
          </h2>

          {/* Combined sync + review progress */}
          <div className="mb-3">
            <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5">
                {current.phase !== 'done' && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />}
                {current.phase === 'done' && <span className="inline-block h-2 w-2 rounded-full bg-green-500" />}
                {current.processed_events} / {current.total_events || '?'} 活動
              </span>
              <span className="text-slate-600">
                {current.total_guests_upserted} guests
                {current.total_guests_removed > 0 && (
                  <span className="text-red-600"> · 移除 {current.total_guests_removed}</span>
                )}
                {current.failed_events > 0 && <span> · 失敗 {current.failed_events}</span>}
                {' · '}{fmtDuration(current.started_at, null)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-slate-200">
              <div
                className="h-full bg-[#10B8D9] transition-all"
                style={{
                  width: current.total_events > 0
                    ? `${(current.processed_events / current.total_events) * 100}%`
                    : '0%',
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="text-green-700">核准 {current.review_approved}</span>
              <span className="text-amber-700">候補 {current.review_waitlisted}</span>
              {current.review_skipped > 0 && <span>跳過 {current.review_skipped}</span>}
            </div>
          </div>

          <ul className="max-h-96 space-y-1 overflow-y-auto text-xs">
            {results.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1">
                <span className={`rounded-full px-2 py-0.5 font-medium ${statusColor(r.status)}`}>{r.status}</span>
                <span className="flex-1 truncate text-slate-700">{r.event_name ?? r.event_api_id}</span>
                <span className="text-slate-500" title="本次同步該活動的 guest 總數">{r.guests_count}</span>
                {r.review_approved > 0 && (
                  <span className="text-green-700" title="核准">✓{r.review_approved}</span>
                )}
                {r.review_waitlisted > 0 && (
                  <span className="text-amber-700" title="候補">⏳{r.review_waitlisted}</span>
                )}
                {r.review_skipped > 0 && (
                  <span className="text-slate-500" title="跳過（審核錯誤）">↷{r.review_skipped}</span>
                )}
                {r.guests_removed > 0 && (
                  <span className="text-red-600" title="移除：本地有但 Luma 已無">−{r.guests_removed}</span>
                )}
                {r.error_message && <span className="max-w-xs truncate text-red-600">{r.error_message}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">最近 20 筆</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-3">#</th>
                <th className="pr-3">觸發</th>
                <th className="pr-3">狀態</th>
                <th className="pr-3">開始</th>
                <th className="pr-3">耗時</th>
                <th className="pr-3">進度</th>
                <th className="pr-3">失敗</th>
                <th className="pr-3">Guests</th>
                <th className="pr-3">審核</th>
                <th>觸發者</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((j) => (
                <Fragment key={j.id}>
                  <tr
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => expandedJobId === j.id ? setExpandedJobId(null) : fetchExpanded(j.id)}
                  >
                    <td className="py-2 pr-3">{j.id}</td>
                    <td className="pr-3">{j.trigger}</td>
                    <td className="pr-3">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${statusColor(j.status)}`}>{j.status}</span>
                    </td>
                    <td className="pr-3">{fmtDate(j.started_at)}</td>
                    <td className="pr-3">{fmtDuration(j.started_at, j.finished_at)}</td>
                    <td className="pr-3">{j.processed_events}/{j.total_events}</td>
                    <td className="pr-3">{j.failed_events}</td>
                    <td className="pr-3">
                      {j.total_guests_upserted}
                      {j.total_guests_removed > 0 && (
                        <span className="text-red-600"> (−{j.total_guests_removed})</span>
                      )}
                    </td>
                    <td className="pr-3">
                      {(j.review_approved + j.review_declined + j.review_waitlisted) > 0 ? (
                        <span className="text-[10px]">
                          <span className="text-green-700">{j.review_approved}✓</span>
                          {j.review_declined > 0 && (
                            <>
                              {' '}
                              <span className="text-red-600">{j.review_declined}✗</span>
                            </>
                          )}
                          {' '}
                          <span className="text-amber-700">{j.review_waitlisted}⏳</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="max-w-[160px] truncate">{j.triggered_by ?? '—'}</td>
                  </tr>
                  {expandedJobId === j.id && (
                    <tr>
                      <td colSpan={10} className="bg-slate-50 px-3 py-2">
                        {j.error_summary && (
                          <p className="mb-2 text-red-600">錯誤：{j.error_summary}</p>
                        )}
                        <ul className="max-h-72 space-y-1 overflow-y-auto">
                          {expandedResults.map((r) => (
                            <li key={r.id} className="flex items-center gap-2 rounded bg-white px-2 py-1">
                              <span className={`rounded-full px-2 py-0.5 font-medium ${statusColor(r.status)}`}>{r.status}</span>
                              <span className="flex-1 truncate">{r.event_name ?? r.event_api_id}</span>
                              <span className="text-slate-500">{r.guests_count}</span>
                              {r.guests_removed > 0 && (
                                <span className="text-red-600" title="移除：本地有但 Luma 已無">−{r.guests_removed}</span>
                              )}
                              {r.error_message && <span className="max-w-xs truncate text-red-600">{r.error_message}</span>}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
