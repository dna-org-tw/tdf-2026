'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface NotificationLog {
  id: string;
  subject: string;
  recipient_groups: string[];
  recipient_tiers: string[] | null;
  recipient_count: number;
  success_count: number | null;
  failure_count: number | null;
  sent_by: string;
  status: string;
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

export default function AdminDashboard() {
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/history')
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications || []))
      .catch((err) => console.error('[Admin]', err))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Taipei',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">發送紀錄</h1>
        <Link
          href="/admin/send"
          className="bg-[#10B8D9] hover:bg-[#0EA5C4] text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          發送新通知
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <p className="text-slate-500">尚無發送紀錄</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const statusStyle = STATUS_STYLES[n.status] || { label: n.status, className: 'bg-slate-100 text-slate-600' };
            const hasDetail = n.success_count !== null || n.failure_count !== null;
            return (
              <Link
                key={n.id}
                href={`/admin/history/${n.id}`}
                className="block bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">{n.subject}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusStyle.className}`}>
                        {statusStyle.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {n.recipient_groups.map((g) => GROUP_LABELS[g] || g).join('、')}
                      {n.recipient_tiers && n.recipient_tiers.length > 0 && (
                        <span className="ml-1">({n.recipient_tiers.join(', ')})</span>
                      )}
                      <span className="mx-2">·</span>
                      {n.recipient_count} 人
                      {hasDetail && (
                        <>
                          <span className="mx-1">—</span>
                          <span className="text-green-600">{n.success_count ?? 0} 成功</span>
                          {(n.failure_count ?? 0) > 0 && (
                            <span className="text-red-600 ml-1">{n.failure_count} 失敗</span>
                          )}
                        </>
                      )}
                      <span className="mx-2">·</span>
                      {n.sent_by}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-slate-400">{formatDate(n.created_at)}</span>
                    <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
