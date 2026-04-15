'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

type Category = 'newsletter' | 'events' | 'award';
const CATEGORIES: readonly Category[] = ['newsletter', 'events', 'award'];

interface ApiPayload {
  email: string;
  unsubscribed: boolean;
  preferences: Record<Category, boolean>;
  hasSubscriptionRow: boolean;
}

interface Props {
  userEmail: string;
}

export default function EmailPreferences({ userEmail }: Props) {
  const { t } = useTranslation();
  const tp = t.auth.memberPreferences;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [prefs, setPrefs] = useState<Record<Category, boolean>>({
    newsletter: true,
    events: true,
    award: true,
  });
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/member/preferences');
        if (!res.ok) throw new Error('load failed');
        const data: ApiPayload = await res.json();
        if (cancelled) return;
        setUnsubscribed(data.unsubscribed);
        setPrefs(data.preferences);
      } catch {
        if (!cancelled) setMessage({ kind: 'err', text: tp.error });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tp.error]);

  const togglePref = (cat: Category) => {
    setPrefs((cur) => ({ ...cur, [cat]: !cur[cat] }));
    if (unsubscribed) setUnsubscribed(false);
  };

  const submit = async (unsubscribeAll: boolean) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/member/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unsubscribeAll ? { unsubscribeAll: true } : { preferences: prefs }),
      });
      if (!res.ok) throw new Error('save failed');
      const data: ApiPayload = await res.json();
      setUnsubscribed(data.unsubscribed);
      setPrefs(data.preferences);
      setMessage({ kind: 'ok', text: tp.saved });
    } catch {
      setMessage({ kind: 'err', text: tp.error });
    } finally {
      setSaving(false);
    }
  };

  const description = tp.description.replace('{email}', userEmail);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
        <div className="h-3 bg-slate-200 rounded w-2/3" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900 mb-1">{tp.title}</h2>
      <p className="text-sm text-slate-500 mb-4">{description}</p>

      {unsubscribed && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-sm">
          {tp.unsubscribed}
        </div>
      )}

      <div className="space-y-3 mb-4">
        {CATEGORIES.map((cat) => {
          const cInfo = tp.categories[cat];
          return (
            <label key={cat} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs[cat] && !unsubscribed}
                onChange={() => togglePref(cat)}
                className="mt-1 h-4 w-4 accent-[#10B8D9]"
              />
              <span>
                <span className="block font-medium text-slate-900">{cInfo.label}</span>
                <span className="block text-sm text-slate-500">{cInfo.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          disabled={saving}
          onClick={() => submit(false)}
          className="bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? tp.saving : tp.save}
        </button>
        <button
          type="button"
          disabled={saving || unsubscribed}
          onClick={() => submit(true)}
          className="text-sm text-slate-500 hover:text-red-500 disabled:opacity-50 transition-colors"
        >
          {tp.unsubscribeAll}
        </button>
        {message && (
          <span className={`text-sm ${message.kind === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
            {message.text}
          </span>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">{tp.mandatoryNote}</p>
    </div>
  );
}
