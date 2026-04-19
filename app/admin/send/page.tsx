'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  type MemberStatus,
  type MemberTier,
  type MemberIdentity,
  type DisplayStatus,
  MEMBER_TIERS,
  MEMBER_IDENTITIES,
  DISPLAY_STATUSES,
  DISPLAY_STATUS_LABELS_ZH,
  DISPLAY_STATUS_TO_DB,
  IDENTITY_LABELS_ZH,
  TIER_LABELS_ZH,
} from '@/lib/members';

interface Preset {
  id: string;
  label: string;
  displayStatuses?: DisplayStatus[];
  memberTiers?: MemberTier[];
  identities?: MemberIdentity[];
  testOnly?: boolean;
}

const PRESETS: Preset[] = [
  { id: 'test', label: '寄送測試信（寄給自己）', testOnly: true },
  { id: 'all-paid', label: '全體已完成', displayStatuses: ['completed'] },
  { id: 'vip', label: 'VIP (已完成 + S/A)', displayStatuses: ['completed'], memberTiers: ['S', 'A'] },
  { id: 'chase', label: '催單 (待完成/已放棄)', displayStatuses: ['pending', 'abandoned'] },
  { id: 'wake', label: '冷名單喚醒 (未開始 B/C)', displayStatuses: ['not_started'], memberTiers: ['B', 'C'] },
];

type BodyFormat = 'plain' | 'html';

function buildPlainPreviewHtml(body: string, subject: string): string {
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

function buildPreviewHtml(body: string, subject: string, format: BodyFormat): string {
  return format === 'html' ? body : buildPlainPreviewHtml(body, subject);
}

export default function SendNotificationPage() {
  const router = useRouter();
  const [testOnly, setTestOnly] = useState(false);
  const [displayStatuses, setDisplayStatuses] = useState<DisplayStatus[]>([]);
  const [memberTiers, setMemberTiers] = useState<MemberTier[]>([]);
  const [identities, setIdentities] = useState<MemberIdentity[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [bodyFormat, setBodyFormat] = useState<BodyFormat>('plain');
  type Category = 'newsletter' | 'events' | 'award' | 'critical';
  const [category, setCategory] = useState<Category>('newsletter');
  const [criticalAck, setCriticalAck] = useState(false);
  const isCritical = category === 'critical';
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [emailConfig, setEmailConfig] = useState<{ from: string; replyTo: string | null; domain: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/admin/email-config')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setEmailConfig(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isCritical) setCriticalAck(false);
  }, [isCritical]);

  const applyPreset = (p: Preset) => {
    setTestOnly(!!p.testOnly);
    setDisplayStatuses(p.displayStatuses || []);
    setMemberTiers(p.memberTiers || []);
    setIdentities(p.identities || []);
  };

  const toggle = <T extends string>(val: T, cur: T[], setCur: (v: T[]) => void) => {
    setCur(cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]);
  };

  // Map identity selections to ticketTier values for the API
  const identityToTicketTiers = (ids: MemberIdentity[]): string[] => {
    const tiers: string[] = [];
    for (const id of ids) {
      if (id === 'backer') tiers.push('backer', 'weekly_backer');
      else if (id === 'contributor') tiers.push('contribute');
      else if (id === 'explorer') tiers.push('explore');
      // follower has no ticket tier — handled via status filter
    }
    return tiers;
  };

  // Map display status selections to DB status values for the API
  const displayStatusToDbStatuses = (dss: DisplayStatus[]): MemberStatus[] => {
    const result: MemberStatus[] = [];
    for (const ds of dss) result.push(...DISPLAY_STATUS_TO_DB[ds]);
    return result;
  };

  const fetchCount = useCallback(async () => {
    if (testOnly) {
      setRecipientCount(1);
      return;
    }
    if (!displayStatuses.length && !memberTiers.length && !identities.length) {
      setRecipientCount(null);
      return;
    }
    setLoadingCount(true);
    try {
      const params = new URLSearchParams();
      const dbStatuses = displayStatusToDbStatuses(displayStatuses);
      const ticketTiers = identityToTicketTiers(identities);
      if (dbStatuses.length) params.set('statuses', dbStatuses.join(','));
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
  }, [testOnly, displayStatuses, memberTiers, identities, category]);

  useEffect(() => {
    const t = setTimeout(fetchCount, 200);
    return () => clearTimeout(t);
  }, [fetchCount]);

  const canSubmit =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    (testOnly || displayStatuses.length > 0 || memberTiers.length > 0 || identities.length > 0);

  const submit = async () => {
    setError('');
    setSuccessMessage('');
    setSending(true);
    try {
      const payload: Record<string, unknown> = { subject, body, category, bodyFormat };
      if (testOnly) {
        payload.groups = ['test'];
      } else {
        const dbStatuses = displayStatusToDbStatuses(displayStatuses);
        const ticketTiers = identityToTicketTiers(identities);
        if (dbStatuses.length) payload.statuses = dbStatuses;
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
    <div className={`flex gap-8 items-start ${showPreview ? '' : 'max-w-4xl'}`}>
      <div className="flex-1 min-w-0">
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
            { value: 'critical', label: '⚠️ 重大通知（無法退訂）' },
          ] as const).map((opt) => {
            const selected = category === opt.value;
            const isCriticalOpt = opt.value === 'critical';
            const baseClass = 'px-3 py-1.5 text-sm rounded-lg border cursor-pointer';
            const selectedClass = isCriticalOpt
              ? 'border-red-500 bg-red-50 text-red-700'
              : 'border-[#10B8D9] bg-[#10B8D9]/10 text-[#10B8D9]';
            const idleClass = isCriticalOpt
              ? 'border-red-300 bg-white text-red-600 hover:bg-red-50'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50';
            return (
              <label
                key={opt.value}
                className={`${baseClass} ${selected ? selectedClass : idleClass}`}
              >
                <input
                  type="radio"
                  name="category"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setCategory(opt.value)}
                  className="hidden"
                />
                {opt.label}
              </label>
            );
          })}
        </div>
        {!isCritical && (
          <p className="text-xs text-slate-500 mt-2">
            收件人若關閉此分類偏好將自動排除。
          </p>
        )}
        {isCritical && (
          <div
            role="alert"
            data-testid="critical-warning"
            className="mt-3 border border-red-400 bg-red-50 text-red-800 rounded-lg p-3 text-sm space-y-1"
          >
            <div className="font-semibold">重大通知模式</div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>僅限重大變更、會員權益異動、簽證或安全等履約必要事項</li>
              <li>將忽略收件人的分類偏好與退訂設定（仍排除硬退信／投訴名單）</li>
              <li>信件底部不會附退訂連結，改顯示客服聯絡方式</li>
              <li>必須至少選一個身份／狀態／等級條件（禁止空篩選群發）</li>
              <li>發送紀錄會特別標記供稽核</li>
            </ul>
          </div>
        )}
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
              <div className="text-xs text-slate-500 mb-1">身份（多選）</div>
              <div className="flex flex-wrap gap-2">
                {MEMBER_IDENTITIES.map((id) => (
                  <label key={id} className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-lg text-sm">
                    <input
                      type="checkbox"
                      checked={identities.includes(id)}
                      onChange={() => toggle(id, identities, setIdentities)}
                    />
                    {IDENTITY_LABELS_ZH[id]}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <div className="text-xs text-slate-500 mb-1">狀態（多選）</div>
              <div className="flex flex-wrap gap-2">
                {DISPLAY_STATUSES.map((ds) => (
                  <label key={ds} className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-lg text-sm">
                    <input
                      type="checkbox"
                      checked={displayStatuses.includes(ds)}
                      onChange={() => toggle(ds, displayStatuses, setDisplayStatuses)}
                    />
                    {DISPLAY_STATUS_LABELS_ZH[ds]}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">等級（多選）</div>
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">內容格式</span>
          {([
            { value: 'plain' as const, label: '純文字' },
            { value: 'html' as const, label: 'HTML（原始）' },
          ]).map((opt) => (
            <label
              key={opt.value}
              className={`px-3 py-1 text-xs rounded-lg border cursor-pointer ${
                bodyFormat === opt.value
                  ? 'border-[#10B8D9] bg-[#10B8D9]/10 text-[#10B8D9]'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="bodyFormat"
                value={opt.value}
                checked={bodyFormat === opt.value}
                onChange={() => setBodyFormat(opt.value)}
                className="hidden"
              />
              {opt.label}
            </label>
          ))}
          <span className="text-xs text-slate-400">
            {bodyFormat === 'html'
              ? '（系統會在 </body> 前自動追加退訂連結與寄件人地址）'
              : '（純文字會自動套用品牌外框）'}
          </span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={bodyFormat === 'html'
            ? '貼上完整 HTML（含 <html><body>…）'
            : '內文（支援換行）'}
          rows={bodyFormat === 'html' ? 18 : 12}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm font-mono"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => setShowPreview((v) => !v)}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {showPreview ? '關閉預覽' : '預覽'}
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
      </div>

      {showPreview && (
        <aside className="flex-1 min-w-0 sticky top-4 h-[calc(100vh-2rem)]">
          <div className="bg-white rounded-xl p-4 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-sm font-semibold text-slate-700">
                預覽
                <span className="ml-2 text-xs text-slate-400">
                  {bodyFormat === 'html' ? 'HTML（不含系統 footer）' : '純文字 + 品牌外框'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
                aria-label="關閉預覽"
              >
                ✕
              </button>
            </div>
            <iframe
              className="w-full flex-1 min-h-0 border border-slate-200 rounded bg-white"
              srcDoc={buildPreviewHtml(body, subject, bodyFormat)}
              title="email preview"
            />
          </div>
        </aside>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">
              {isCritical ? '確認發送重大通知' : '確認發送'}
            </h3>
            <p className="text-sm text-slate-700 mb-4">
              即將寄送「{subject}」給 {testOnly ? '你自己' : `${recipientCount ?? '?'} 位收件人`}，確認嗎？
            </p>
            {isCritical && !testOnly && (
              <label className="flex items-start gap-2 mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={criticalAck}
                  onChange={(e) => setCriticalAck(e.target.checked)}
                  data-testid="critical-ack"
                  className="mt-0.5"
                />
                <span>我確認此通知符合重大通知定義（重大變更／權益異動／簽證安全），並理解將忽略收件人退訂設定。</span>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowConfirm(false); setCriticalAck(false); }} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">取消</button>
              <button
                onClick={submit}
                disabled={sending || (isCritical && !testOnly && !criticalAck)}
                className="px-4 py-2 text-sm text-white bg-[#10B8D9] rounded-lg disabled:opacity-50"
              >
                {sending ? '發送中…' : '確認發送'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
