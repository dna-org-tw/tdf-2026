'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import {
  type EnrichedMember,
  STATUS_LABELS_ZH,
  STATUS_BADGE_CLASSES,
  TIER_LABELS_ZH,
  TIER_BADGE_CLASSES,
  TICKET_TIER_LABELS,
  TICKET_TIER_BADGE_CLASSES,
} from '@/lib/members';

interface MemberRow {
  id: number;
  member_no: string;
  email: string;
  first_seen_at: string;
  created_at: string;
}

interface Order {
  id: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  ticket_tier: string;
  status: string;
  amount_total: number;
  amount_discount: number;
  currency: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: Record<string, unknown> | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  payment_method_type: string | null;
  visitor_id: string | null;
  created_at: string;
  updated_at: string;
}

interface NewsletterSub {
  id: string;
  email: string;
  source: string | null;
  timezone: string | null;
  locale: string | null;
  country: string | null;
  ip_address: string | null;
  visitor_id: string | null;
  created_at: string;
}

interface EmailLog {
  id: string;
  to_email: string;
  subject: string | null;
  email_type: string;
  status: string;
  error_message: string | null;
  notification_id: string | null;
  mailgun_message_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface NotificationCampaign {
  id: string;
  subject: string;
  recipient_count: number;
  status: string;
  sent_by: string;
  created_at: string;
}

interface AwardVote {
  id: string;
  post_id: string;
  email: string;
  confirmed: boolean;
  token: string | null;
  created_at: string;
  confirmed_at: string | null;
}

interface Visitor {
  fingerprint: string;
  ip_address: string | null;
  timezone: string | null;
  locale: string | null;
  user_agent: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

interface TrackingEvent {
  event_name: string;
  parameters: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

interface MemberDetail {
  member: MemberRow;
  enriched: EnrichedMember | null;
  orders: Order[];
  newsletter: NewsletterSub | null;
  email_logs: EmailLog[];
  notification_campaigns: NotificationCampaign[];
  award_votes: AwardVote[];
  visitors: Visitor[];
  tracking_events: TrackingEvent[];
}

function formatAmount(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function formatDateTime(s: string | null | undefined) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei',
  });
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-slate-900 font-semibold text-lg">{value}</div>
    </div>
  );
}

function SendEmailModal({ memberNo, email, onClose, onSent }: {
  memberNo: string; email: string; onClose: () => void; onSent: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    if (!subject.trim() || !body.trim()) { setErr('主旨與內容不可空白'); return; }
    setSending(true);
    setErr(null);
    const res = await fetch(`/api/admin/members/${encodeURIComponent(memberNo)}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { onSent(); }
    else { setErr(data.error || `寄送失敗 (${res.status})`); }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-xl p-5 max-w-lg w-full">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">寄信給 {email}</h3>
        <input
          value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder="主旨"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 mb-2"
        />
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="內容"
          rows={8}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 mb-2"
        />
        {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-700">取消</button>
          <button onClick={send} disabled={sending} className="px-3 py-1.5 text-sm bg-[#10B8D9] text-white rounded-lg hover:bg-[#0EA5C4] disabled:opacity-50">
            {sending ? '寄送中...' : '寄送'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MemberDetailPage({ params }: { params: Promise<{ memberNo: string }> }) {
  const { memberNo } = use(params);
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${encodeURIComponent(memberNo)}`);
      if (res.status === 404) {
        setError('查無此會員');
      } else if (!res.ok) {
        setError('載入失敗');
      } else {
        setData(await res.json());
      }
    } catch {
      setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [memberNo]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleUnsubscribe = async () => {
    if (!confirm('確定要將此會員從電子報退訂嗎？')) return;
    const res = await fetch(`/api/admin/members/${encodeURIComponent(memberNo)}/unsubscribe`, { method: 'POST' });
    if (res.ok) { showToast('已取消訂閱'); load(); }
    else { showToast('退訂失敗'); }
  };

  const handleResend = async (orderId: string) => {
    if (!confirm('重新寄送訂單確認信？')) return;
    const res = await fetch(`/api/admin/members/${encodeURIComponent(memberNo)}/resend-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) { showToast('已重寄確認信'); load(); }
    else { showToast(`重寄失敗：${body.error || res.status}`); }
  };

  if (loading) {
    return (
      <div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}
          </div>
          <div className="h-48 bg-slate-200 rounded-xl" />
          <div className="h-64 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl p-8 text-center shadow-sm">
        <p className="text-slate-600 mb-3">{error || '查無此會員'} {memberNo}</p>
        <Link href="/admin/members" className="text-[#10B8D9] hover:underline">← 回會員列表</Link>
      </div>
    );
  }

  const { member, enriched, orders, newsletter, email_logs, notification_campaigns, award_votes, visitors, tracking_events } = data;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-6 right-6 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-5">
        <Link href="/admin/members" className="text-sm text-slate-500 hover:text-[#10B8D9]">← 回會員列表</Link>
        <div className="flex flex-wrap items-start justify-between gap-4 mt-2">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 font-mono">{member.member_no}</h1>
              {enriched && (
                <>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[enriched.status]}`}>
                    {STATUS_LABELS_ZH[enriched.status]}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIER_BADGE_CLASSES[enriched.tier]}`}>
                    {TIER_LABELS_ZH[enriched.tier]}
                  </span>
                  <span className="text-sm text-slate-500">score: <span className="font-mono text-slate-900">{enriched.score}</span></span>
                </>
              )}
            </div>
            <div className="text-slate-600 mt-1">{member.email}</div>
            <div className="text-xs text-slate-400 mt-1">首次出現：{formatDateTime(member.first_seen_at)}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSendOpen(true)} className="px-3 py-1.5 text-sm bg-[#10B8D9] text-white rounded-lg hover:bg-[#0EA5C4]">寄信</button>
            <button onClick={handleUnsubscribe} disabled={!enriched?.subscribed_newsletter} className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">取消訂閱</button>
            <a href={`/api/admin/members/${encodeURIComponent(memberNo)}/export`} className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">匯出 JSON</a>
          </div>
        </div>
      </div>

      {enriched && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="總消費" value={enriched.total_spent_cents > 0 ? formatAmount(enriched.total_spent_cents, enriched.currency) : '-'} />
          <Kpi label="訂單數" value={String(enriched.paid_order_count)} />
          <Kpi label="電子報" value={enriched.subscribed_newsletter ? '已訂閱' : '未訂閱'} />
          <Kpi label="最近互動" value={formatDateTime(enriched.last_interaction_at)} />
        </div>
      )}

      <Section title="Identity & Contact">
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">姓名</dt><dd className="text-slate-900">{enriched?.name || '-'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">電話</dt><dd className="text-slate-900">{enriched?.phone || '-'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">電子報</dt><dd className="text-slate-900">{enriched?.subscribed_newsletter ? '已訂閱' : '未訂閱'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">來源</dt><dd className="text-slate-900">{newsletter?.source || '-'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Timezone</dt><dd className="text-slate-900">{newsletter?.timezone || '-'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Locale</dt><dd className="text-slate-900">{newsletter?.locale || '-'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">國家</dt><dd className="text-slate-900">{newsletter?.country || '-'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">地址</dt><dd className="text-slate-900 font-mono text-xs break-all">{orders[0]?.customer_address ? JSON.stringify(orders[0].customer_address) : '-'}</dd></div>
        </dl>
      </Section>

      <Section title={`訂單 (${orders.length})`}>
        {orders.length === 0 ? <p className="text-sm text-slate-400">沒有訂單</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">ID</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Tier</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">狀態</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">金額</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">付款方式</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">建立</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const tier = o.ticket_tier as keyof typeof TICKET_TIER_LABELS;
                  return (
                    <tr key={o.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{o.id.slice(0, 8)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${TICKET_TIER_BADGE_CLASSES[tier] || 'bg-slate-100 text-slate-600'}`}>
                          {TICKET_TIER_LABELS[tier] || o.ticket_tier}
                        </span>
                      </td>
                      <td className="px-3 py-2">{o.status}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatAmount(o.amount_total, o.currency)}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {o.payment_method_brand && o.payment_method_last4 ? `${o.payment_method_brand} •••• ${o.payment_method_last4}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(o.created_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <a
                            href={`https://dashboard.stripe.com/payments/${o.stripe_payment_intent_id || o.stripe_session_id}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs text-slate-600 hover:text-[#10B8D9] px-2 py-1 border border-slate-200 rounded"
                          >Stripe</a>
                          {o.status === 'paid' && (
                            <button onClick={() => handleResend(o.id)} className="text-xs text-slate-600 hover:text-[#10B8D9] px-2 py-1 border border-slate-200 rounded">
                              重寄確認信
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`Email 記錄 (${email_logs.length})`}>
        {email_logs.length === 0 ? <p className="text-sm text-slate-400">無發信紀錄</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">時間</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">類型</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">主旨</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">狀態</th>
                </tr>
              </thead>
              <tbody>
                {email_logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(l.created_at)}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{l.email_type}</td>
                    <td className="px-3 py-2 text-slate-900">{l.subject || '-'}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={l.status === 'sent' ? 'text-green-700' : l.status === 'failed' ? 'text-red-700' : 'text-slate-600'}>
                        {l.status}
                      </span>
                      {l.error_message && <div className="text-xs text-red-600 mt-0.5">{l.error_message}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {notification_campaigns.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-slate-500 mb-1">相關群發活動</div>
            <ul className="text-sm space-y-1">
              {notification_campaigns.map((c) => (
                <li key={c.id} className="flex justify-between text-slate-700">
                  <span>{c.subject}</span>
                  <span className="text-xs text-slate-500">{formatDateTime(c.created_at)}（{c.recipient_count}）</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title={`Nomad Award 投票 (${award_votes.length})`}>
        {award_votes.length === 0 ? <p className="text-sm text-slate-400">無投票紀錄</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-3 py-2 font-medium text-slate-600">Post</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">狀態</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">投票時間</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">確認時間</th>
              </tr>
            </thead>
            <tbody>
              {award_votes.map((v) => (
                <tr key={v.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">
                    <a href={`https://instagram.com/p/${v.post_id}`} target="_blank" rel="noreferrer" className="text-[#10B8D9] hover:underline">{v.post_id}</a>
                  </td>
                  <td className="px-3 py-2 text-xs">{v.confirmed ? '已確認' : '待確認'}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(v.created_at)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(v.confirmed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`裝置與訪客 (${visitors.length})`}>
        {visitors.length === 0 ? <p className="text-sm text-slate-400">無裝置資料</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Fingerprint</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">IP</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">國家</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Timezone</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">UA</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">最近</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((v) => (
                  <tr key={v.fingerprint} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{v.fingerprint.slice(0, 12)}</td>
                    <td className="px-3 py-2 text-xs">{v.ip_address || '-'}</td>
                    <td className="px-3 py-2 text-xs">{v.country || '-'}</td>
                    <td className="px-3 py-2 text-xs">{v.timezone || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 max-w-xs truncate" title={v.user_agent || ''}>{v.user_agent || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(v.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`追蹤事件 (${tracking_events.length})`}>
        {tracking_events.length === 0 ? <p className="text-sm text-slate-400">無事件</p> : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">時間</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Event</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Parameters</th>
                </tr>
              </thead>
              <tbody>
                {tracking_events.map((ev, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(ev.occurred_at)}</td>
                    <td className="px-3 py-2 text-xs text-slate-900">{ev.event_name}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 font-mono truncate max-w-md" title={JSON.stringify(ev.parameters)}>
                      {JSON.stringify(ev.parameters)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Raw JSON">
        <details>
          <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">展開完整資料</summary>
          <pre className="mt-3 bg-slate-50 p-3 rounded-lg text-xs overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
        </details>
      </Section>

      {sendOpen && (
        <SendEmailModal
          memberNo={memberNo}
          email={member.email}
          onClose={() => setSendOpen(false)}
          onSent={() => { setSendOpen(false); showToast('信件已送出'); load(); }}
        />
      )}
    </div>
  );
}
