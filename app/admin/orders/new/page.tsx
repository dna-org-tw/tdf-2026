'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TIERS = [
  { value: 'explore', label: 'Explore' },
  { value: 'contribute', label: 'Contribute' },
  { value: 'weekly_backer', label: 'Weekly Backer' },
  { value: 'backer', label: 'Backer' },
];

const WEEKS = [
  { value: 'week1', label: 'Week 1' },
  { value: 'week2', label: 'Week 2' },
  { value: 'week3', label: 'Week 3' },
  { value: 'week4', label: 'Week 4' },
];

export default function NewOrderPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [tier, setTier] = useState('explore');
  const [week, setWeek] = useState('week1');
  const [paymentReference, setPaymentReference] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_email: email,
        customer_name: name,
        ticket_tier: tier,
        ...(tier === 'weekly_backer' ? { week } : {}),
        payment_reference: paymentReference,
        note,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/admin/orders/${data.order.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '建立失敗');
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <a href="/admin/orders" className="text-sm text-slate-500 hover:text-slate-700">← 返回列表</a>
      <h1 className="text-2xl font-bold text-slate-900">手動建單</h1>
      <p className="text-sm text-slate-500">透過 Stripe Invoice 建立一筆線下付款的訂單（標記為 paid out of band）。</p>
      <form onSubmit={submit} className="bg-white rounded-xl p-6 shadow-sm space-y-3">
        <label className="block text-sm">
          Email<span className="text-red-500">*</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" />
        </label>
        <label className="block text-sm">
          姓名<span className="text-red-500">*</span>
          <input required value={name} onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" />
        </label>
        <label className="block text-sm">
          票種<span className="text-red-500">*</span>
          <select value={tier} onChange={(e) => setTier(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm">
            {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        {tier === 'weekly_backer' && (
          <label className="block text-sm">
            週次<span className="text-red-500">*</span>
            <select value={week} onChange={(e) => setWeek(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm">
              {WEEKS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </label>
        )}
        <label className="block text-sm">
          付款參考（如銀行轉帳日期 / 末四碼）
          <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" />
        </label>
        <label className="block text-sm">
          備註
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm" />
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button type="submit" disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] rounded-lg hover:bg-[#0EA5C4] disabled:opacity-50">
          {submitting ? '建立中…' : '建立訂單'}
        </button>
      </form>
    </div>
  );
}
