'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface InviteCode {
  id: string;
  code: string;
  status: string;
  batch_label: string | null;
  used_by_member_id: number | null;
  created_at: string;
}

export default function StayInviteCodesPage() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState('STAY');
  const [batchLabel, setBatchLabel] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/stay/invite-codes/batch')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setCodes(data.codes ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'load_failed'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/stay/invite-codes/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          prefix,
          batchLabel: batchLabel.trim() || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'failed');
      setMessage(`已產生 ${payload.codes?.length ?? 0} 組邀請碼`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'generate_failed');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">邀請碼管理</h1>
        <Link href="/admin/stay" className="text-sm text-slate-500 hover:text-cyan-600">
          ← 回總覽
        </Link>
      </div>

      <form onSubmit={generate} className="bg-white rounded-xl p-5 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900">批次產生</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="text-slate-600">數量 (1-1000)</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">前綴 (最多 16 字元)</span>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">批次標籤 (選填)</span>
            <input
              type="text"
              value={batchLabel}
              onChange={(e) => setBatchLabel(e.target.value)}
              placeholder="e.g. partner-acme"
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={generating}
          className="px-3 py-2 text-sm bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {generating ? '產生中...' : '產生邀請碼'}
        </button>
        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">已存在邀請碼</h2>
          <span className="text-xs text-slate-500">共 {codes.length} 組</span>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-slate-500">載入中...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="py-2 px-3 text-left">Code</th>
                <th className="py-2 px-3 text-left">狀態</th>
                <th className="py-2 px-3 text-left">批次</th>
                <th className="py-2 px-3 text-left">使用者</th>
                <th className="py-2 px-3 text-left">建立時間</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="py-2 px-3 font-mono text-slate-800">{c.code}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : c.status === 'used'
                          ? 'bg-slate-100 text-slate-700'
                          : c.status === 'reserved'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-700">{c.batch_label ?? '—'}</td>
                  <td className="py-2 px-3 text-slate-700">
                    {c.used_by_member_id ? `#${c.used_by_member_id}` : '—'}
                  </td>
                  <td className="py-2 px-3 text-slate-600 tabular-nums">
                    {new Date(c.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {codes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                    尚無邀請碼
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
