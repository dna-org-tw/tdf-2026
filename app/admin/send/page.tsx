'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type RecipientGroup = 'orders' | 'subscribers' | 'test';
type TicketTier = 'explore' | 'contribute' | 'weekly_backer' | 'backer';

const GROUP_OPTIONS: { value: RecipientGroup; label: string; description?: string }[] = [
  { value: 'test', label: '寄送測試信', description: '寄送至自己的信箱' },
  { value: 'orders', label: '付費會員' },
  { value: 'subscribers', label: '電子報訂閱者' },
];

const TIER_OPTIONS: { value: TicketTier; label: string }[] = [
  { value: 'explore', label: 'Explore' },
  { value: 'contribute', label: 'Contribute' },
  { value: 'weekly_backer', label: 'Weekly Backer' },
  { value: 'backer', label: 'Backer' },
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
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
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

  const fetchCount = useCallback(async () => {
    if (groups.length === 0) {
      setRecipientCount(null);
      return;
    }
    setLoadingCount(true);
    try {
      const params = new URLSearchParams();
      params.set('groups', groups.join(','));
      if (groups.includes('orders') && tiers.length > 0) {
        params.set('tiers', tiers.join(','));
      }
      const res = await fetch(`/api/admin/recipients?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecipientCount(data.count);
      }
    } catch {
      setRecipientCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [groups, tiers]);

  useEffect(() => {
    const timer = setTimeout(fetchCount, 300);
    return () => clearTimeout(timer);
  }, [fetchCount]);

  const toggleGroup = (group: RecipientGroup) => {
    setGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const toggleTier = (tier: TicketTier) => {
    setTiers((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
    );
  };

  const isTestOnly = groups.length === 1 && groups[0] === 'test';
  const canSend = groups.length > 0 && subject.trim() && body.trim() && recipientCount && recipientCount > 0;

  const handleSend = async () => {
    setShowConfirm(false);
    setSending(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/admin/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          groups,
          tiers: groups.includes('orders') ? tiers : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '發送失敗');
      }

      if (isTestOnly) {
        setSuccessMessage(`測試信已寄送（${data.recipientCount} 封）`);
      } else {
        router.push('/admin');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '發送失敗');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">發送通知信</h1>

      {/* Email Config Info */}
      {emailConfig && (
        <section className="bg-slate-50 rounded-xl p-4 shadow-sm mb-4 border border-slate-200">
          <h2 className="font-semibold text-slate-700 mb-2 text-sm">信件設定</h2>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500">寄件者 (From)：</span>
            <span className="text-slate-900 font-mono">{emailConfig.from}</span>
            <span className="text-slate-500">回覆地址 (Reply-To)：</span>
            <span className="text-slate-900 font-mono">{emailConfig.replyTo || '未設定（回覆將寄至 From 地址）'}</span>
            <span className="text-slate-500">Mailgun Domain：</span>
            <span className="text-slate-900 font-mono">{emailConfig.domain || '未設定'}</span>
          </div>
        </section>
      )}

      {/* Recipient Selection */}
      <section className="bg-white rounded-xl p-6 shadow-sm mb-4">
        <h2 className="font-semibold text-slate-900 mb-3">收件群組</h2>
        <div className="flex flex-wrap gap-3">
          {GROUP_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={groups.includes(opt.value)}
                onChange={() => toggleGroup(opt.value)}
                className="w-4 h-4 accent-[#10B8D9]"
              />
              <span className="text-sm text-slate-700">
                {opt.label}
                {opt.description && <span className="text-slate-400 ml-1">({opt.description})</span>}
              </span>
            </label>
          ))}
        </div>

        {groups.includes('orders') && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-600 mb-2">票種篩選（不選則包含全部）</h3>
            <div className="flex flex-wrap gap-3">
              {TIER_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tiers.includes(opt.value)}
                    onChange={() => toggleTier(opt.value)}
                    className="w-4 h-4 accent-[#10B8D9]"
                  />
                  <span className="text-sm text-slate-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-slate-500">
          {loadingCount ? (
            '計算收件人數...'
          ) : recipientCount !== null ? (
            <span>共 <strong className="text-slate-900">{recipientCount}</strong> 位收件人</span>
          ) : (
            '請選擇收件群組'
          )}
        </div>
      </section>

      {/* Email Content */}
      <section className="bg-white rounded-xl p-6 shadow-sm mb-4">
        <h2 className="font-semibold text-slate-900 mb-3">信件內容</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">主旨</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="輸入信件主旨"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">內容（純文字）</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="輸入信件內容..."
              rows={10}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900 resize-y"
            />
          </div>
        </div>
      </section>

      {/* Preview */}
      {subject.trim() && body.trim() && (
        <section className="bg-white rounded-xl p-6 shadow-sm mb-4">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm font-medium text-[#10B8D9] hover:underline"
          >
            {showPreview ? '隱藏預覽' : '顯示信件預覽'}
          </button>
          {showPreview && (
            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
              <iframe
                srcDoc={buildPreviewHtml(body, subject)}
                title="Email preview"
                className="w-full h-[400px] border-0"
              />
            </div>
          )}
        </section>
      )}

      {/* Actions */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {successMessage && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{successMessage}</div>
      )}

      <div className="flex gap-3">
        <button
          onClick={isTestOnly ? handleSend : () => setShowConfirm(true)}
          disabled={!canSend || sending}
          className="bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {sending ? '發送中...' : isTestOnly ? '寄送測試信' : '發送通知'}
        </button>
        <button
          onClick={() => router.push('/admin')}
          className="text-slate-500 hover:text-slate-700 font-medium px-6 py-2.5 transition-colors"
        >
          取消
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">確認發送</h3>
            <p className="text-slate-600 mb-1">主旨：{subject}</p>
            <p className="text-slate-600 mb-4">
              將發送給 <strong>{recipientCount}</strong> 位收件人。此操作無法撤銷。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="text-slate-500 hover:text-slate-700 font-medium px-4 py-2 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSend}
                className="bg-[#10B8D9] hover:bg-[#0EA5C4] text-white font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                確認發送
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
