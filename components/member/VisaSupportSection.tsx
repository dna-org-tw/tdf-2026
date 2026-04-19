'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Order } from '@/lib/types/order';
import CollapsibleSection from '@/components/member/CollapsibleSection';
import VisaSupportForm from './VisaSupportForm';
import VisaLetterSummary from './VisaLetterSummary';

interface VisaSupportSectionProps {
  orders: Order[];
  lang?: 'en' | 'zh';
  labels: {
    title: string;
    intro: string;
    disclaimer: string;
    legalName: string;
    nationality: string;
    dateOfBirth: string;
    passportNumber: string;
    passportCountry: string;
    passportExpiry: string;
    arrival: string;
    departure: string;
    stayAddress: string;
    destinationMission: string;
    save: string;
    saving: string;
    saved: string;
    download: string;
    downloading: string;
    summaryTitle: string;
    summaryPaid: string;
    summaryUnpaid: string;
    summaryEnglish: string;
    fieldRequired: string;
    fieldDateOrder: string;
    fieldPassportExpiry: string;
    fieldLegalName: string;
    loadError: string;
    saveError: string;
    downloadError: string;
    rateLimited: string;
  };
}

const REQUIRED_FIELDS = [
  'legal_name_en',
  'nationality',
  'date_of_birth',
  'passport_number',
  'passport_country',
  'passport_expiry_date',
  'planned_arrival_date',
  'planned_departure_date',
  'taiwan_stay_address',
] as const;

const DEFAULT_VALUES: Record<string, string> = {
  legal_name_en: '',
  nationality: '',
  date_of_birth: '',
  passport_number: '',
  passport_country: '',
  passport_expiry_date: '',
  planned_arrival_date: '',
  planned_departure_date: '',
  taiwan_stay_address: '',
  destination_mission: '',
};

export default function VisaSupportSection({ orders, lang = 'en', labels }: VisaSupportSectionProps) {
  const [values, setValues] = useState<Record<string, string>>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  // Track whether the user has started editing to avoid overwriting on late fetch response
  const dirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/member/visa-profile')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => {
        if (cancelled) return;
        setValues((prev) => {
          // Merge: keep any values the user has already typed (non-empty prev wins)
          const merged: Record<string, string> = {
            legal_name_en: prev.legal_name_en || (data.legal_name_en ?? ''),
            nationality: prev.nationality || (data.nationality ?? ''),
            date_of_birth: prev.date_of_birth || (data.date_of_birth ?? ''),
            passport_number: prev.passport_number || (data.passport_number ?? ''),
            passport_country: prev.passport_country || (data.passport_country ?? ''),
            passport_expiry_date: prev.passport_expiry_date || (data.passport_expiry_date ?? ''),
            planned_arrival_date: prev.planned_arrival_date || (data.planned_arrival_date ?? ''),
            planned_departure_date: prev.planned_departure_date || (data.planned_departure_date ?? ''),
            taiwan_stay_address: prev.taiwan_stay_address || (data.taiwan_stay_address ?? ''),
            destination_mission: prev.destination_mission || (data.destination_mission ?? ''),
          };
          return merged;
        });
        if (!cancelled && !dirtyRef.current) setSaved(Boolean(data.updated_at));
      })
      .catch(() => { if (!cancelled) setError(labels.loadError); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [labels.loadError]);

  const errors = useMemo(() => {
    const next: Partial<Record<string, string>> = {};
    for (const field of REQUIRED_FIELDS) {
      if (!values[field]) next[field] = labels.fieldRequired;
    }
    if (/[\u3400-\u9FFF\uF900-\uFAFF]/u.test(values.legal_name_en)) {
      next.legal_name_en = labels.fieldLegalName;
    }
    if (values.planned_arrival_date && values.planned_departure_date && values.planned_departure_date <= values.planned_arrival_date) {
      next.planned_departure_date = labels.fieldDateOrder;
    }
    if (values.passport_expiry_date && values.planned_departure_date && values.passport_expiry_date <= values.planned_departure_date) {
      next.passport_expiry_date = labels.fieldPassportExpiry;
    }
    return next;
  }, [values, labels]);

  const hasPaidOrder = orders.some((order) => order.status === 'paid');
  const canDownload = saved && Object.keys(errors).length === 0 && !downloading;

  async function saveDetails() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/member/visa-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      setError(labels.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function downloadLetter() {
    setDownloading(true);
    setError('');
    try {
      const res = await fetch('/api/member/visa-letter', { method: 'POST' });
      if (res.status === 429) {
        const data = await res.json();
        const minutes = Math.max(1, Math.ceil((Number(data.retryAfter) || 60) / 60));
        throw new Error(labels.rateLimited.replace('{minutes}', String(minutes)));
      }
      if (!res.ok) throw new Error(labels.downloadError);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = res.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1] ?? 'tdf-visa-support-letter.pdf';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.downloadError);
    } finally {
      setDownloading(false);
    }
  }

  const formLabels = {
    ...labels,
    showSensitive: lang === 'zh' ? '顯示' : 'Show',
    hideSensitive: lang === 'zh' ? '遮蔽' : 'Hide',
    sensitiveHint: lang === 'zh'
      ? '敏感欄位預設遮蔽，以保護您的隱私'
      : 'Masked by default for privacy',
  };

  const privacyBlurb = lang === 'zh'
    ? '敏感欄位（護照號碼、出生日期）預設遮蔽；資料加密儲存，活動結束後 60 天自動刪除，僅於產生邀請函時由系統讀取。'
    : 'Sensitive fields (passport, DOB) are masked by default. Data is encrypted at rest and auto-deleted 60 days after the festival — the TDF team only accesses it to generate your letter.';

  return (
    <div id="visa-support">
      <CollapsibleSection title={labels.title} count={loading ? '…' : 'PDF'} defaultOpen={false} tone="visa">
        <div className="mt-2 space-y-4">
          <p className="text-sm text-slate-600">{labels.intro}</p>
          <div className="rounded-xl border border-stone-200 bg-white/70 px-4 py-3 flex items-start gap-3 text-sm text-slate-600 leading-relaxed">
            <svg viewBox="0 0 20 20" className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <rect x="4" y="9" width="12" height="7" rx="1.5" />
              <path d="M7 9V6a3 3 0 016 0v3" />
            </svg>
            <span>{privacyBlurb}</span>
          </div>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{labels.disclaimer}</p>
          <VisaSupportForm
            values={values}
            errors={errors}
            labels={formLabels}
            onChange={(field, value) => {
              dirtyRef.current = true;
              setValues((prev) => ({ ...prev, [field]: value }));
              setSaved(false);
            }}
          />
          <VisaLetterSummary
            title={labels.summaryTitle}
            englishHint={labels.summaryEnglish}
            paidLabel={labels.summaryPaid}
            unpaidLabel={labels.summaryUnpaid}
            hasPaidOrder={hasPaidOrder}
            values={values}
          />
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {saved && !error ? <p className="text-sm text-green-600">{labels.saved}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving || Object.keys(errors).length > 0}
              onClick={saveDetails}
              className="rounded-lg bg-[#0E0E10] hover:bg-[#2A2A2E] disabled:bg-stone-300 disabled:text-stone-500 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
            >
              {saving ? labels.saving : labels.save}
            </button>
            <button
              type="button"
              disabled={!canDownload}
              onClick={downloadLetter}
              className="rounded-lg bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:bg-stone-300 disabled:text-stone-500 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
            >
              {downloading ? labels.downloading : labels.download}
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
