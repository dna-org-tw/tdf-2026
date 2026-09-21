'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

export interface TransferOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: { to_email: string; child_order_ids: string[] }) => void;
  order: {
    id: string;
    ticket_tier: string | null;
    customer_email: string | null;
  };
  endpoint: string;
  mode: 'user' | 'admin';
  hasChildOrders?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function TransferOrderModal({
  open,
  onClose,
  onSuccess,
  order,
  endpoint,
  mode,
  hasChildOrders = false,
}: TransferOrderModalProps) {
  const { lang } = useTranslation();
  const zh = lang === 'zh';

  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [email1, setEmail1] = useState('');
  const [email2, setEmail2] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStep('form');
      setEmail1('');
      setEmail2('');
      setNotes('');
      setSubmitting(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const currentEmail = (order.customer_email ?? '').toLowerCase();
  const e1 = email1.trim().toLowerCase();
  const e2 = email2.trim().toLowerCase();

  const validEmail = EMAIL_RE.test(e1);
  const match = e1 === e2;
  const notSame = e1 !== currentEmail;
  const formValid = validEmail && match && notSame && e1.length > 0;

  const handleNext = () => {
    setError('');
    if (!validEmail) {
      setError(zh ? 'Email 格式錯誤' : 'Invalid email format');
      return;
    }
    if (!match) {
      setError(zh ? '兩次輸入的 email 不一致' : 'Emails do not match');
      return;
    }
    if (!notSame) {
      setError(zh ? '新票主 email 不能與目前票主相同' : 'New email must differ from current owner');
      return;
    }
    setStep('confirm');
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload: Record<string, string> = { new_email: e1 };
      if (mode === 'user') payload.order_id = order.id;
      if (mode === 'admin' && notes.trim()) payload.notes = notes.trim();

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onSuccess({ to_email: data.to_email ?? e1, child_order_ids: data.child_order_ids ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
        {step === 'form' && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {zh ? '轉讓訂單' : 'Transfer Order'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  {order.id.slice(0, 8)} · {order.ticket_tier ?? '-'}
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
                <p>
                  {zh
                    ? '⚠️ 轉讓後此訂單將不再屬於您，此操作無法復原。'
                    : '⚠️ After transfer this order no longer belongs to you. This action cannot be undone.'}
                </p>
                {hasChildOrders && (
                  <p>
                    {zh
                      ? '此訂單有升級（子訂單），將一併轉讓。'
                      : 'This order has an upgrade — the upgrade order will be transferred together.'}
                  </p>
                )}
              </div>

              <div className="text-sm">
                <p className="text-slate-500 mb-1">{zh ? '目前票主' : 'Current owner'}</p>
                <p className="font-mono text-slate-900 text-xs break-all">{currentEmail || '-'}</p>
              </div>

              <label className="block text-sm">
                <span className="text-slate-700 font-medium">
                  {zh ? '新票主 email' : 'New owner email'}
                </span>
                <input
                  type="email"
                  autoComplete="off"
                  value={email1}
                  onChange={(e) => setEmail1(e.target.value)}
                  placeholder="new-owner@example.com"
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#10B8D9]"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-700 font-medium">
                  {zh ? '再次輸入新票主 email' : 'Confirm new owner email'}
                </span>
                <input
                  type="email"
                  autoComplete="off"
                  value={email2}
                  onChange={(e) => setEmail2(e.target.value)}
                  placeholder={zh ? '再次輸入以確認' : 'Type again to confirm'}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#10B8D9]"
                />
                {email2.length > 0 && !match && (
                  <p className="mt-1 text-xs text-red-500">
                    {zh ? '兩次輸入不一致' : "Emails don't match"}
                  </p>
                )}
              </label>

              {mode === 'admin' && (
                <label className="block text-sm">
                  <span className="text-slate-700 font-medium">{zh ? '備註（選填）' : 'Notes (optional)'}</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm"
                    placeholder={zh ? '為何執行此轉讓？' : 'Why is this transfer needed?'}
                  />
                </label>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                {zh ? '取消' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!formValid}
                className="px-4 py-2 text-sm text-white bg-[#10B8D9] hover:bg-[#0EA5C4] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {zh ? '下一步' : 'Next'}
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                {zh ? '再次確認' : 'Confirm transfer'}
              </h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-900 space-y-2">
                <p>
                  {zh
                    ? '您即將把下列訂單轉讓給：'
                    : 'You are about to transfer this order to:'}
                </p>
                <p className="font-mono text-base font-bold break-all">{e1}</p>
                <p className="text-xs">
                  {zh
                    ? '此操作無法復原，完成後此訂單將從您的帳戶移除，並寄發通知信給雙方。'
                    : 'This cannot be undone. The order will be removed from your account and both parties will be notified by email.'}
                </p>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p>
                  {zh ? '訂單 ID：' : 'Order ID: '}
                  <span className="font-mono text-slate-900">{order.id}</span>
                </p>
                <p>
                  {zh ? '票種：' : 'Ticket: '}
                  <span className="text-slate-900">{order.ticket_tier ?? '-'}</span>
                </p>
                {hasChildOrders && (
                  <p className="text-amber-700">
                    {zh ? '連同升級訂單一併轉讓。' : 'Upgrade order will transfer together.'}
                  </p>
                )}
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep('form')}
                disabled={submitting}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                {zh ? '返回' : 'Back'}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 shadow-sm"
              >
                {submitting
                  ? zh ? '處理中…' : 'Transferring…'
                  : zh ? '確認轉讓' : 'Confirm transfer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
