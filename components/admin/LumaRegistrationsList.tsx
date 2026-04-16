'use client';

import type { Registration } from '@/lib/lumaSyncTypes';

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending_approval: { text: '申請中', color: 'bg-amber-100 text-amber-800' },
  approved: { text: '已核准', color: 'bg-green-100 text-green-800' },
  declined: { text: '已拒絕', color: 'bg-slate-200 text-slate-700' },
  waitlist: { text: '候補中', color: 'bg-blue-100 text-blue-800' },
  invited: { text: '已邀請', color: 'bg-purple-100 text-purple-800' },
};

function formatAmount(cents: number | null, currency: string | null): string {
  if (cents == null || cents === 0) return '';
  const major = (cents / 100).toFixed(0);
  return `${currency ?? ''} ${major}`.trim();
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function LumaRegistrationsList({ registrations }: { registrations: Registration[] }) {
  if (registrations.length === 0) {
    return <p className="text-sm text-slate-500">尚無 Luma 報名紀錄</p>;
  }
  return (
    <ul className="space-y-3">
      {registrations.map((r) => {
        const status = r.activityStatus ? STATUS_LABELS[r.activityStatus] : null;
        const amount = formatAmount(r.amountCents, r.currency);
        return (
          <li
            key={r.eventApiId}
            className={`rounded-lg border border-slate-200 bg-white p-4 ${r.stale ? 'opacity-60' : ''}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-slate-900 hover:text-[#10B8D9]"
                  >
                    {r.eventName}
                  </a>
                ) : (
                  <span className="font-semibold text-slate-900">{r.eventName}</span>
                )}
                <div className="mt-1 text-xs text-slate-500">{formatDate(r.startAt)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {status ? (
                  <span className={`rounded-full px-2 py-0.5 font-medium ${status.color}`}>
                    {status.text}
                  </span>
                ) : r.activityStatus ? (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700">
                    {r.activityStatus}
                  </span>
                ) : null}
                {r.paid && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                    已付款
                  </span>
                )}
                {r.checkedInAt && (
                  <span className="rounded-full bg-cyan-100 px-2 py-0.5 font-medium text-cyan-800">
                    已 check-in
                  </span>
                )}
                {r.stale && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700">
                    可能已取消
                  </span>
                )}
              </div>
            </div>
            {(r.ticketTypeName || amount) && (
              <div className="mt-2 text-xs text-slate-600">
                {r.ticketTypeName} {amount && `· ${amount}`}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
