'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Week {
  id: number;
  code: string;
  starts_on: string;
  ends_on: string;
  price_twd: number;
  room_capacity: number;
  status: 'active' | 'sold_out' | 'closed';
  waitlist_offer_expires_in_minutes: number;
}

const STATUS_OPTIONS: Week['status'][] = ['active', 'sold_out', 'closed'];

interface FormState {
  price_twd: number;
  room_capacity: number;
  status: Week['status'];
  waitlist_offer_expires_in_minutes: number;
}

export default function StayWeeksPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [forms, setForms] = useState<Record<number, FormState>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/stay/summary')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const list: Week[] = data.weeks ?? [];
        setWeeks(list);
        const initial: Record<number, FormState> = {};
        for (const w of list) {
          initial[w.id] = {
            price_twd: w.price_twd,
            room_capacity: w.room_capacity,
            status: w.status,
            waitlist_offer_expires_in_minutes: w.waitlist_offer_expires_in_minutes,
          };
        }
        setForms(initial);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'load_failed'))
      .finally(() => setLoading(false));
  }, []);

  function updateForm(id: number, patch: Partial<FormState>) {
    setForms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function save(week: Week) {
    const form = forms[week.id];
    if (!form) return;
    setSavingId(week.id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stay/weeks/${week.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'failed');
      setMessage(`已更新 ${week.code}`);
      if (payload.week) {
        setWeeks((prev) => prev.map((w) => (w.id === week.id ? payload.week : w)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'save_failed');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">週次管理</h1>
        <Link href="/admin/stay" className="text-sm text-slate-500 hover:text-cyan-600">
          ← 回總覽
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-500">載入中...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {weeks.map((w) => {
          const form = forms[w.id];
          if (!form) return null;
          return (
            <div key={w.id} className="bg-white rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="font-mono font-semibold text-slate-800">{w.code}</h2>
                <span className="text-xs text-slate-500">
                  {w.starts_on} – {w.ends_on}
                </span>
              </div>

              <label className="block text-sm">
                <span className="text-slate-600">單價 (TWD)</span>
                <input
                  type="number"
                  min={0}
                  value={form.price_twd}
                  onChange={(e) => updateForm(w.id, { price_twd: Number(e.target.value) })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">房間容量</span>
                <input
                  type="number"
                  min={1}
                  value={form.room_capacity}
                  onChange={(e) => updateForm(w.id, { room_capacity: Number(e.target.value) })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">狀態</span>
                <select
                  value={form.status}
                  onChange={(e) => updateForm(w.id, { status: e.target.value as Week['status'] })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">候補 offer 到期 (分鐘)</span>
                <input
                  type="number"
                  min={1}
                  value={form.waitlist_offer_expires_in_minutes}
                  onChange={(e) =>
                    updateForm(w.id, { waitlist_offer_expires_in_minutes: Number(e.target.value) })
                  }
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900"
                />
              </label>

              <button
                onClick={() => save(w)}
                disabled={savingId === w.id}
                className="w-full px-3 py-2 text-sm bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {savingId === w.id ? '儲存中...' : '儲存'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
