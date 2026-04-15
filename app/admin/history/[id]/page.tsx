'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface NotificationDetail {
  id: string;
  subject: string;
  body: string;
  recipient_groups: string[];
  recipient_tiers: string[] | null;
  recipient_count: number;
  success_count: number;
  failure_count: number;
  sent_by: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface EmailLog {
  id: string;
  to_email: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  error_message: string | null;
  mailgun_message_id: string | null;
  created_at: string;
}

const GROUP_LABELS: Record<string, string> = {
  orders: '付費會員',
  subscribers: '電子報訂閱者',
  test: '測試',
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  sending: { label: '發送中', className: 'bg-yellow-100 text-yellow-700' },
  sent: { label: '已發送', className: 'bg-green-100 text-green-700' },
  partial_failure: { label: '部分失敗', className: 'bg-red-100 text-red-700' },
};

const EMAIL_STATUS: Record<string, { label: string; dotClass: string }> = {
  pending: { label: '排隊中', dotClass: 'bg-slate-400' },
  processing: { label: '發送中', dotClass: 'bg-yellow-500 animate-pulse' },
  sent: { label: '成功', dotClass: 'bg-green-500' },
  failed: { label: '失敗', dotClass: 'bg-red-500' },
};

export default function NotificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [notification, setNotification] = useState<NotificationDetail | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');
  const [retrying, setRetrying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/history/${id}`);
      const data = await res.json();
      if (data.notification) setNotification(data.notification);
      if (data.emailLogs) setEmailLogs(data.emailLogs);
      return data.emailLogs as EmailLog[] | undefined;
    } catch (err) {
      console.error('[Detail] fetch error', err);
      return undefined;
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    fetchDetail().then(() => setLoading(false));
  }, [fetchDetail]);

  // Poll for progress while there are pending/processing emails (backend is sending)
  useEffect(() => {
    const hasPending = emailLogs.some((l) => l.status === 'pending' || l.status === 'processing');

    if (hasPending && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        fetchDetail();
      }, 3000);
    }

    if (!hasPending && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [emailLogs, fetchDetail]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/admin/history/${id}/retry`, { method: 'POST' });
      const data = await res.json();
      if (data.retried > 0) {
        await fetchDetail();
      }
    } catch (err) {
      console.error('[Detail] retry error', err);
    } finally {
      setRetrying(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Taipei',
    });
  };

  const filtered = emailLogs.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return log.status === 'pending' || log.status === 'processing';
    return log.status === filter;
  });

  const pendingCount = emailLogs.filter((l) => l.status === 'pending' || l.status === 'processing').length;
  const sentCount = emailLogs.filter((l) => l.status === 'sent').length;
  const failedCount = emailLogs.filter((l) => l.status === 'failed').length;
  const total = emailLogs.length;
  const doneCount = sentCount + failedCount;
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
          <div className="h-4 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center">
        <p className="text-slate-500">找不到此發送紀錄</p>
        <Link href="/admin/history" className="text-[#10B8D9] hover:underline mt-2 inline-block">
          返回紀錄列表
        </Link>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[notification.status] || {
    label: notification.status,
    className: 'bg-slate-100 text-slate-600',
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/history"
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">發送細項</h1>
      </div>

      {/* Notification summary */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-slate-900">{notification.subject}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.className}`}>
                {statusStyle.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {notification.recipient_groups.map((g) => GROUP_LABELS[g] || g).join('、')}
              {notification.recipient_tiers && notification.recipient_tiers.length > 0 && (
                <span className="ml-1">({notification.recipient_tiers.join(', ')})</span>
              )}
              <span className="mx-2">·</span>
              {notification.sent_by}
              <span className="mx-2">·</span>
              {formatDate(notification.created_at)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {pendingCount > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>發送進度</span>
              <span>{doneCount} / {total} ({progressPct}%)</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressPct}%`,
                  background: failedCount > 0
                    ? 'linear-gradient(90deg, #22c55e 0%, #22c55e var(--sent), #ef4444 var(--sent), #ef4444 100%)'
                    : '#22c55e',
                  ['--sent' as string]: total > 0 ? `${(sentCount / doneCount) * 100}%` : '100%',
                }}
              />
            </div>
          </div>
        )}

        {/* Counts */}
        <div className="flex gap-4 mb-4">
          <div className="bg-slate-50 rounded-lg px-4 py-3 flex-1 text-center">
            <div className="text-2xl font-bold text-slate-900">{notification.recipient_count}</div>
            <div className="text-xs text-slate-500">預定發送</div>
          </div>
          {pendingCount > 0 && (
            <div className="bg-yellow-50 rounded-lg px-4 py-3 flex-1 text-center">
              <div className="text-2xl font-bold text-yellow-700">{pendingCount}</div>
              <div className="text-xs text-yellow-600">排隊中</div>
            </div>
          )}
          <div className="bg-green-50 rounded-lg px-4 py-3 flex-1 text-center">
            <div className="text-2xl font-bold text-green-700">{sentCount}</div>
            <div className="text-xs text-green-600">成功</div>
          </div>
          <div className="bg-red-50 rounded-lg px-4 py-3 flex-1 text-center">
            <div className="text-2xl font-bold text-red-700">{failedCount}</div>
            <div className="text-xs text-red-600">失敗</div>
          </div>
        </div>

        {notification.error_message && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
            {notification.error_message}
          </div>
        )}

        {/* Retry button */}
        {failedCount > 0 && pendingCount === 0 && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="bg-red-50 hover:bg-red-100 text-red-700 font-medium px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {retrying ? '重新排入中…' : `重試 ${failedCount} 封失敗的信件`}
          </button>
        )}

        {/* Email body preview */}
        <details className="mt-4">
          <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
            查看信件內容
          </summary>
          <pre className="mt-2 bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap font-sans">
            {notification.body}
          </pre>
        </details>
      </div>

      {/* Email logs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">
            收件人明細
            <span className="text-sm font-normal text-slate-400 ml-2">({filtered.length})</span>
          </h3>
          <div className="flex gap-1">
            {(['all', 'pending', 'sent', 'failed'] as const).map((f) => {
              const labels = { all: '全部', pending: '排隊中', sent: '成功', failed: '失敗' };
              const count = f === 'all' ? total : f === 'pending' ? pendingCount : f === 'sent' ? sentCount : failedCount;
              if (f === 'pending' && pendingCount === 0) return null;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {labels[f]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {emailLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            尚無收件人紀錄（舊的發送紀錄不含細項）
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            沒有符合篩選條件的紀錄
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((log) => {
              const es = EMAIL_STATUS[log.status] || EMAIL_STATUS.pending;
              return (
                <div key={log.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${es.dotClass}`} title={es.label} />
                      <span className="text-sm text-slate-900 font-mono truncate" title={log.to_email}>{log.to_email}</span>
                      {(log.status === 'pending' || log.status === 'processing') && (
                        <span className="text-xs text-slate-400 shrink-0">{es.label}</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{formatDate(log.created_at)}</span>
                  </div>
                  {log.mailgun_message_id && (
                    <p className="text-xs text-slate-400 mt-1 ml-4 font-mono truncate" title={log.mailgun_message_id}>
                      Message ID: {log.mailgun_message_id}
                    </p>
                  )}
                  {log.error_message && (
                    <p className="text-xs text-red-500 mt-1 ml-4 break-all">
                      {log.error_message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
