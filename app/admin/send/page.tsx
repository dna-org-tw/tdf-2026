'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  MEMBER_STATUSES,
  MEMBER_TIERS,
  TICKET_TIERS,
  STATUS_LABELS_ZH,
  TIER_LABELS_ZH,
  TICKET_TIER_LABELS,
} from '@/lib/members';

interface Preset {
  id: string;
  label: string;
  statuses?: MemberStatus[];
  memberTiers?: MemberTier[];
  ticketTiers?: TicketTier[];
  testOnly?: boolean;
}

const PRESETS: Preset[] = [
  { id: 'test', label: '寄送測試信（寄給自己）', testOnly: true },
  { id: 'all-paid', label: '全體付費', statuses: ['paid'] },
  { id: 'vip', label: 'VIP (付費 + S/A)', statuses: ['paid'], memberTiers: ['S', 'A'] },
  { id: 'chase', label: '催單 (待付/放棄)', statuses: ['pending', 'abandoned'] },
  { id: 'wake', label: '冷名單喚醒 (訂閱者 B/C)', statuses: ['subscriber'], memberTiers: ['B', 'C'] },
];

function buildPreviewHtml(body: string, subject: string): string {
  const bodyHtml = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 24px;">Taiwan Digital Fest 2026</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #10B8D9; margin-top: 0;">${subject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h2>
    <div style="color: #333; font-size: 16px;">${bodyHtml}</div>
    <p style="color: #666; font-size: 14px; margin-top: 30px;">Best regards,<br>Taiwan Digital Fest 2026 Team</p>
  </div>
  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    <p>This is an automated email from Taiwan Digital Fest 2026.</p>
  </div>
</body>
</html>`;
}

export default function SendNotificationPage() {
  const router = useRouter();
  const [testOnly, setTestOnly] = useState(false);
  const [statuses, setStatuses] = useState<MemberStatus[]>([]);
  const [memberTiers, setMemberTiers] = useState<MemberTier[]>([]);
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  type Category = 'newsletter' | 'events' | 'award';
  const [category, setCategory] = useState<Category>('newsletter');
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [emailConfig, setEmailConfig] = useState<{ from: string; replyTo: string | null; domain: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/admin/email-config')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setEmailConfig(data); })
      .catch(() => {});
  }, []);

  const applyPreset = (p: Preset) => {
    setTestOnly(!!p.testOnly);
    setStatuses(p.statuses || []);
    setMemberTiers(p.memberTiers || []);
    setTicketTiers(p.ticketTiers || []);
  };

  const toggle = <T extends string>(val: T, cur: T[], setCur: (v: T[]) => void) => {
    setCur(cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]);
  };

  const fetchCount = useCallback(async () => {
    if (testOnly) {
      setRecipientCount(1);
      return;
    }
    if (!statuses.length && !memberTiers.length && !ticketTiers.length) {
      setRecipientCount(null);
      return;
    }
    setLoadingCount(true);
    try {
      const params = new URLSearchParams();
      if (statuses.length) params.set('statuses', statuses.join(','));
      if (memberTiers.length) params.set('memberTiers', memberTiers.join(','));
      if (ticketTiers.length) params.set('ticketTiers', ticketTiers.join(','));
      params.set('category', category);
      const res = await fetch(`/api/admin/recipients?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecipientCount(data.count ?? 0);
      } else {
        setRecipientCount(null);
      }
    } finally {
      setLoadingCount(false);
    }
  }, [testOnly, statuses, memberTiers, ticketTiers, category]);

  useEffect(() => {
    const t = setTimeout(fetchCount, 200);
    return () => clearTimeout(t);
  }, [fetchCount]);

  const canSubmit =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    (testOnly || statuses.length > 0 || memberTiers.length > 0 || ticketTiers.length > 0);

  const submit = async () => {
    setError('');
    setSuccessMessage('');
    setSending(true);
    try {
      const payload: Record<string, unknown> = { subject, body, category };
      if (testOnly) {
        payload.groups = ['test'];
      } else {
        if (statuses.length) payload.statuses = statuses;
        if (memberTiers.length) payload.memberTiers = memberTiers;
        if (ticketTiers.length) payload.ticketTiers = ticketTiers;
      }
      const res = await fetch('/api/admin/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '發送失敗');
      } else {
        setSuccessMessage(`已寄送給 ${data.queued ?? recipientCount} 位收件人`);
        setShowConfirm(false);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '發送失敗');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">發送通知</h1>

      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <div className="text-xs text-slate-500 mb-2">快速預設</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <div className="text-xs text-slate-500 mb-2">信件分類（必選）</div>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'newsletter', label: '節慶電子報' },
            { value: 'events', label: '活動與議程更新' },
            { value: 'award', label: 'Nomad Award 與社群活動' },
          ] as const).map((opt) => (
            <label
              key={opt.value}
              className={`px-3 py-1.5 text-sm rounded-lg border cursor-pointer ${
                category === opt.value
                  ? 'border-[#10B8D9] bg-[#10B8D9]/10 text-[#10B8D9]'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="category"
                value={opt.value}
                checked={category === opt.value}
                onChange={() => setCategory(opt.value)}
                className="hidden"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          收件人若關閉此分類偏好將自動排除。
        </p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={testOnly}
            onChange={(e) => setTestOnly(e.target.checked)}
          />
          <span className="text-sm text-slate-700">寄送測試信（僅寄到自己的信箱）</span>
        </label>

        {!testOnly && (
          <>
            <div className="mb-3">
              <div className="text-xs text-slate-500 mb-1">會員狀態（多選）</div>
              <div className="flex flex-wrap gap-2">
                {MEMBER_STATUSES.map((s) => (
                  <label key={s} className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-lg text-sm">
                    <input
                      type="checkbox"
                      checked={statuses.includes(s)}
                      onChange={() => toggle(s, statuses, setStatuses)}
                    />
                    {STATUS_LABELS_ZH[s]}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <div className="text-xs text-slate-500 mb-1">會員等級（多選）</div>
              <div className="flex flex-wrap gap-2">
                {MEMBER_TIERS.map((t) => (
                  <label key={t} className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-lg text-sm">
                    <input
                      type="checkbox"
                      checked={memberTiers.includes(t)}
                      onChange={() => toggle(t, memberTiers, setMemberTiers)}
                    />
                    {TIER_LABELS_ZH[t]}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">票種篩選（僅對「已付費」生效）</div>
              <div className="flex flex-wrap gap-2">
                {TICKET_TIERS.map((t) => (
                  <label key={t} className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-lg text-sm">
                    <input
                      type="checkbox"
                      checked={ticketTiers.includes(t)}
                      onChange={() => toggle(t, ticketTiers, setTicketTiers)}
                    />
                    {TICKET_TIER_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-3 text-sm text-slate-500">
          {testOnly
            ? '將只寄給自己'
            : loadingCount
              ? '計算收件人中…'
              : recipientCount !== null
                ? `符合收件人：${recipientCount} 位`
                : '請選擇至少一個篩選條件'}
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 space-y-3">
        {emailConfig && (
          <div className="text-xs text-slate-500">
            寄件人：{emailConfig.from}{emailConfig.replyTo ? ` · 回信至 ${emailConfig.replyTo}` : ''}
          </div>
        )}
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="主旨"
          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="內文（支援換行）"
          rows={12}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm font-mono"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => setShowPreview(true)}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            預覽
          </button>
          <button
            type="button"
            disabled={!canSubmit || sending}
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {sending ? '發送中…' : '發送'}
          </button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {successMessage && <div className="text-sm text-green-700">{successMessage}</div>}
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-xl p-4 max-w-xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">預覽</h3>
            <iframe
              className="w-full h-[60vh] border border-slate-200 rounded"
              srcDoc={buildPreviewHtml(body, subject)}
            />
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">確認發送</h3>
            <p className="text-sm text-slate-700 mb-4">
              即將寄送「{subject}」給 {testOnly ? '你自己' : `${recipientCount ?? '?'} 位收件人`}，確認嗎？
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">取消</button>
              <button onClick={submit} disabled={sending} className="px-4 py-2 text-sm text-white bg-[#10B8D9] rounded-lg disabled:opacity-50">
                {sending ? '發送中…' : '確認發送'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
