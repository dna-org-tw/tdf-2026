'use client';

import { useEffect, useState } from 'react';

function formatLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  // datetime-local expects local time without timezone suffix
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function AdminSettingsPage() {
  const [deadline, setDeadline] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const [cutoff, setCutoff] = useState<string | null>(null);
  const [cutoffInput, setCutoffInput] = useState('');
  const [cutoffSaving, setCutoffSaving] = useState(false);
  const DEFAULT_CUTOFF_ISO = '2026-04-20T16:00:00Z';

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/order-transfer-deadline');
      if (res.ok) {
        const data = await res.json();
        setDeadline(data.value ?? null);
        setInput(formatLocalInputValue(data.value ?? null));
      }

      const cRes = await fetch('/api/admin/settings/ticket-sale-cutoff');
      if (cRes.ok) {
        const cData = await cRes.json();
        setCutoff(cData.value ?? null);
        setCutoffInput(formatLocalInputValue(cData.value ?? DEFAULT_CUTOFF_ISO));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const save = async () => {
    if (!input) {
      showToast('請輸入日期時間');
      return;
    }
    const localDate = new Date(input);
    if (isNaN(localDate.getTime())) {
      showToast('時間格式無效');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/order-transfer-deadline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: localDate.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(`儲存失敗：${data.error ?? '未知錯誤'}`);
        return;
      }
      setDeadline(data.value);
      showToast('已儲存');
    } finally {
      setSaving(false);
    }
  };

  const deadlinePassed = deadline
    ? (() => {
        const d = new Date(deadline);
        return !isNaN(d.getTime()) && Date.now() > d.getTime();
      })()
    : false;

  const saveCutoff = async () => {
    if (!cutoffInput) {
      showToast('請輸入日期時間');
      return;
    }
    const localDate = new Date(cutoffInput);
    if (isNaN(localDate.getTime())) {
      showToast('時間格式無效');
      return;
    }
    setCutoffSaving(true);
    try {
      const res = await fetch('/api/admin/settings/ticket-sale-cutoff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: localDate.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(`儲存失敗：${data.error ?? '未知錯誤'}`);
        return;
      }
      setCutoff(data.value);
      showToast('已儲存');
    } finally {
      setCutoffSaving(false);
    }
  };

  const cutoffPassed = cutoff
    ? (() => {
        const d = new Date(cutoff);
        return !isNaN(d.getTime()) && Date.now() > d.getTime();
      })()
    : (Date.now() > new Date(DEFAULT_CUTOFF_ISO).getTime());

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">設定</h1>
        <p className="text-sm text-slate-500 mt-1">站內設定。</p>
      </div>

      <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">訂單轉讓截止時間</h2>
          <p className="text-xs text-slate-500 mt-1">
            此時間之後，會員無法自助轉讓訂單（管理員仍可強制執行）。預設為 2026-04-30 23:59:59 (台北時間)。
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">載入中…</p>
        ) : (
          <>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-slate-500">目前設定值：</span>
                <span className="font-mono text-slate-900">{deadline ?? '(未設定)'}</span>
              </div>
              {deadline && (
                <div>
                  <span className="text-slate-500">本地顯示：</span>
                  <span className="text-slate-900">
                    {new Date(deadline).toLocaleString('zh-TW', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei',
                      timeZoneName: 'short',
                    })}
                  </span>
                </div>
              )}
              {deadlinePassed && (
                <div className="inline-block mt-1 px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">
                  已過截止時間 · 使用者自助轉讓已停用
                </div>
              )}
            </div>

            <label className="block text-sm">
              <span className="text-slate-700 font-medium">新的截止時間（本地時區）</span>
              <input
                type="datetime-local"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm font-mono"
              />
            </label>

            <div className="flex gap-2 pt-2">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] hover:bg-[#0EA5C4] rounded-lg disabled:opacity-50"
              >
                {saving ? '儲存中…' : '儲存'}
              </button>
              <button
                onClick={() => setInput(formatLocalInputValue(deadline))}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                重設
              </button>
            </div>
          </>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">售票截止時間</h2>
          <p className="text-xs text-slate-500 mt-1">
            此時間之後，公開購票頁與會員自助升級會關閉（後台手動開單／升級不受影響）。預設為 2026-04-21 00:00（台北時間）。
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">載入中…</p>
        ) : (
          <>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-slate-500">目前設定值：</span>
                <span className="font-mono text-slate-900">
                  {cutoff ?? `(未設定，使用預設 ${DEFAULT_CUTOFF_ISO})`}
                </span>
              </div>
              <div>
                <span className="text-slate-500">本地顯示：</span>
                <span className="text-slate-900">
                  {new Date(cutoff ?? DEFAULT_CUTOFF_ISO).toLocaleString('zh-TW', {
                    year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei',
                    timeZoneName: 'short',
                  })}
                </span>
              </div>
              {cutoffPassed && (
                <div className="inline-block mt-1 px-2 py-0.5 text-xs bg-rose-100 text-rose-800 rounded">
                  已過截止時間 · 公開購票與自助升級已關閉
                </div>
              )}
            </div>

            <label className="block text-sm">
              <span className="text-slate-700 font-medium">新的截止時間（本地時區）</span>
              <input
                type="datetime-local"
                value={cutoffInput}
                onChange={(e) => setCutoffInput(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm font-mono"
              />
            </label>

            <div className="flex gap-2 pt-2">
              <button
                onClick={saveCutoff}
                disabled={cutoffSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] hover:bg-[#0EA5C4] rounded-lg disabled:opacity-50"
              >
                {cutoffSaving ? '儲存中…' : '儲存'}
              </button>
              <button
                onClick={() => setCutoffInput(formatLocalInputValue(cutoff ?? DEFAULT_CUTOFF_ISO))}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                重設
              </button>
            </div>
          </>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
