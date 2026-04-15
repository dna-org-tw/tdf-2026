'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Order {
  id: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  ticket_tier: string;
  status: string;
  source: 'stripe_checkout' | 'stripe_invoice_offline';
  amount_subtotal: number;
  amount_total: number;
  amount_tax: number;
  amount_discount: number;
  amount_refunded: number;
  currency: string;
  customer_email: string | null;
  customer_name: string | null;
  internal_notes: string | null;
  created_at: string;
}

interface OrderAction {
  id: string;
  admin_email: string;
  action: string;
  payload: Record<string, unknown> | null;
  stripe_response: Record<string, unknown> | null;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
  expired: 'bg-orange-100 text-orange-700',
  refunded: 'bg-purple-100 text-purple-700',
  partially_refunded: 'bg-fuchsia-100 text-fuchsia-700',
};

const STATUS_LABELS: Record<string, string> = {
  paid: '已付款', pending: '待處理', failed: '失敗', cancelled: '已取消',
  expired: '已過期', refunded: '已退款', partially_refunded: '部分退款',
};

const ACTION_LABELS: Record<string, string> = {
  refund: '退款', cancel: '取消', edit: '編輯顧客', resend_receipt: '重寄收據',
  note: '備註', manual_create: '手動建單',
};

function formatAmount(amount: number, currency: string) {
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function formatDate(s: string) {
  return new Date(s).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei',
  });
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [actions, setActions] = useState<OrderAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string>('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/orders/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setOrder(data.order);
      setActions(data.actions);
      setNotes(data.order.internal_notes ?? '');
    } else if (res.status === 404) {
      router.replace('/admin/orders');
    }
  }, [params.id, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // --- Customer edit ---
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const beginEdit = () => {
    if (!order) return;
    setEditName(order.customer_name ?? '');
    setEditEmail(order.customer_email ?? '');
    setEditing(true);
  };
  const saveEdit = async () => {
    const res = await fetch(`/api/admin/orders/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: editName, customer_email: editEmail }),
    });
    if (res.ok) {
      setEditing(false);
      showToast('已更新');
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(`失敗：${data.error ?? '未知錯誤'}`);
    }
  };

  // --- Refund modal ---
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState<'requested_by_customer' | 'duplicate' | 'fraudulent'>('requested_by_customer');
  const [refundNote, setRefundNote] = useState('');
  const [refundConfirm, setRefundConfirm] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const openRefund = () => {
    if (!order) return;
    setRefundAmount(order.amount_total - order.amount_refunded);
    setRefundReason('requested_by_customer');
    setRefundNote('');
    setRefundConfirm('');
    setRefundOpen(true);
  };
  const submitRefund = async () => {
    setRefundSubmitting(true);
    const res = await fetch(`/api/admin/orders/${params.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: refundAmount, reason: refundReason, note: refundNote }),
    });
    setRefundSubmitting(false);
    if (res.ok) {
      setRefundOpen(false);
      showToast('已退款');
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(`退款失敗：${data.error ?? '未知錯誤'}`);
    }
  };

  // --- Cancel ---
  const doCancel = async () => {
    if (!confirm('確定取消此訂單？')) return;
    const res = await fetch(`/api/admin/orders/${params.id}/cancel`, { method: 'POST' });
    if (res.ok) { showToast('已取消'); load(); }
    else {
      const data = await res.json().catch(() => ({}));
      showToast(`失敗：${data.error ?? '未知錯誤'}`);
    }
  };

  // --- Resend receipt ---
  const doResend = async () => {
    const res = await fetch(`/api/admin/orders/${params.id}/resend-receipt`, { method: 'POST' });
    if (res.ok) showToast('收據已重寄');
    else {
      const data = await res.json().catch(() => ({}));
      showToast(`失敗：${data.error ?? '未知錯誤'}`);
    }
  };

  // --- Notes ---
  const saveNotes = async () => {
    const res = await fetch(`/api/admin/orders/${params.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ internal_notes: notes }),
    });
    if (res.ok) { showToast('備註已儲存'); load(); }
    else {
      const data = await res.json().catch(() => ({}));
      showToast(`失敗：${data.error ?? '未知錯誤'}`);
    }
  };

  if (loading) return <div className="text-slate-500">載入中…</div>;
  if (!order) return <div className="text-slate-500">找不到訂單</div>;

  const canRefund = order.status === 'paid' || order.status === 'partially_refunded';
  const canCancel = order.status === 'pending';
  const canResend = (order.status === 'paid' || order.status === 'partially_refunded') && order.source === 'stripe_checkout';
  const remaining = order.amount_total - order.amount_refunded;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <a href="/admin/orders" className="text-sm text-slate-500 hover:text-slate-700">← 返回列表</a>
      </div>

      <h1 className="text-2xl font-bold text-slate-900">訂單 {order.id.slice(0, 8)}</h1>

      {/* Info card */}
      <div className="bg-white rounded-xl p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[order.status] ?? 'bg-slate-100'}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {order.source === 'stripe_invoice_offline' ? '手動（線下付款）' : 'Stripe Checkout'}
          </span>
          <span className="text-sm text-slate-500 ml-auto">{formatDate(order.created_at)}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-slate-500">票種：</span><span className="text-slate-900">{order.ticket_tier}</span></div>
          <div><span className="text-slate-500">小計：</span><span className="text-slate-900 font-mono">{formatAmount(order.amount_subtotal, order.currency)}</span></div>
          <div><span className="text-slate-500">折扣：</span><span className="text-slate-900 font-mono">-{formatAmount(order.amount_discount, order.currency)}</span></div>
          <div><span className="text-slate-500">稅：</span><span className="text-slate-900 font-mono">{formatAmount(order.amount_tax, order.currency)}</span></div>
          <div><span className="text-slate-500">總計：</span><span className="text-slate-900 font-mono font-semibold">{formatAmount(order.amount_total, order.currency)}</span></div>
          <div><span className="text-slate-500">已退款：</span><span className="text-slate-900 font-mono">{formatAmount(order.amount_refunded, order.currency)}</span></div>
        </div>
        <div className="pt-3 border-t border-slate-100 text-xs space-y-1">
          {order.stripe_session_id && (
            <div><span className="text-slate-500">Session：</span><span className="font-mono text-slate-700">{order.stripe_session_id}</span></div>
          )}
          {order.stripe_payment_intent_id && (
            <div><span className="text-slate-500">PaymentIntent：</span><span className="font-mono text-slate-700">{order.stripe_payment_intent_id}</span></div>
          )}
          {order.stripe_invoice_id && (
            <div><span className="text-slate-500">Invoice：</span><span className="font-mono text-slate-700">{order.stripe_invoice_id}</span></div>
          )}
        </div>
      </div>

      {/* Customer card */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">顧客資訊</h2>
          {!editing ? (
            <button onClick={beginEdit} className="text-xs text-[#10B8D9] hover:underline">編輯</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={saveEdit} className="text-xs px-3 py-1 bg-[#10B8D9] text-white rounded">儲存</button>
              <button onClick={() => setEditing(false)} className="text-xs px-3 py-1 text-slate-600 border border-slate-300 rounded">取消</button>
            </div>
          )}
        </div>
        {!editing ? (
          <div className="space-y-1 text-sm">
            <div><span className="text-slate-500">姓名：</span><span className="text-slate-900">{order.customer_name ?? '-'}</span></div>
            <div><span className="text-slate-500">Email：</span><span className="text-slate-900">{order.customer_email ?? '-'}</span></div>
            {order.customer_email && (
              <div>
                <a
                  href={`/admin/members/${encodeURIComponent(order.customer_email)}`}
                  className="text-xs text-[#10B8D9] hover:underline"
                >
                  查看會員頁 →
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <input className="w-full px-3 py-2 border border-slate-300 rounded text-sm" placeholder="姓名" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <input className="w-full px-3 py-2 border border-slate-300 rounded text-sm" placeholder="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          </div>
        )}
      </div>

      {/* Actions card */}
      <div className="bg-white rounded-xl p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900">操作</h2>
        <div className="flex flex-wrap gap-2">
          {canRefund && <button onClick={openRefund} className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600">退款</button>}
          {canCancel && <button onClick={doCancel} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">取消訂單</button>}
          {canResend && <button onClick={doResend} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">重寄收據</button>}
        </div>
        <div className="pt-3 border-t border-slate-100">
          <label className="text-sm text-slate-700 font-medium">內部備註</label>
          <textarea className="w-full mt-2 px-3 py-2 border border-slate-300 rounded text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button onClick={saveNotes} className="mt-2 px-3 py-1 text-xs font-medium text-white bg-[#10B8D9] rounded">儲存備註</button>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-3">操作歷史</h2>
        {actions.length === 0 ? (
          <p className="text-sm text-slate-400">尚無記錄</p>
        ) : (
          <ul className="space-y-3">
            {actions.map((a) => (
              <li key={a.id} className="border-l-2 border-slate-200 pl-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-slate-900">{ACTION_LABELS[a.action] ?? a.action}</span>
                  <span className={`px-1.5 py-0.5 rounded ${a.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {a.status === 'success' ? '成功' : '失敗'}
                  </span>
                  <span className="text-slate-500">{a.admin_email}</span>
                  <span className="text-slate-400 ml-auto">{formatDate(a.created_at)}</span>
                </div>
                {a.error_message && <div className="mt-1 text-xs text-red-600">{a.error_message}</div>}
                {a.payload && <pre className="mt-1 text-xs text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">{JSON.stringify(a.payload, null, 2)}</pre>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Refund modal */}
      {refundOpen && order && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-semibold text-slate-900">退款</h3>
            {order.source === 'stripe_invoice_offline' && (
              <div className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded">
                這是線下付款訂單，Stripe 沒有收款記錄。此操作只更新 DB — 請另外處理實際金流。
              </div>
            )}
            <label className="text-sm">
              金額（分）剩餘可退 {remaining}
              <input type="number" min={1} max={remaining} value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" />
            </label>
            <label className="text-sm">
              原因
              <select value={refundReason} onChange={(e) => setRefundReason(e.target.value as typeof refundReason)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm">
                <option value="requested_by_customer">客戶要求</option>
                <option value="duplicate">重複付款</option>
                <option value="fraudulent">盜刷</option>
              </select>
            </label>
            <label className="text-sm">
              備註
              <textarea value={refundNote} onChange={(e) => setRefundNote(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" rows={2} />
            </label>
            <label className="text-sm">
              輸入 <code className="text-red-600">REFUND</code> 確認
              <input value={refundConfirm} onChange={(e) => setRefundConfirm(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRefundOpen(false)} className="px-3 py-1 text-sm text-slate-600 border border-slate-300 rounded">取消</button>
              <button onClick={submitRefund}
                disabled={refundConfirm !== 'REFUND' || refundSubmitting || refundAmount <= 0 || refundAmount > remaining}
                className="px-3 py-1 text-sm text-white bg-red-500 rounded disabled:opacity-50">
                {refundSubmitting ? '處理中…' : '確認退款'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
