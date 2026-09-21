'use client';

import { useEffect, useState } from 'react';
import { COUNTRIES } from '@/lib/countries';

interface VisaSupportFormProps {
  values: Record<string, string>;
  errors: Partial<Record<string, string>>;
  labels: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10B8D9]';

type RowType = 'text' | 'date' | 'textarea' | 'country';

const SENSITIVE_FIELDS = new Set(['passport_number', 'date_of_birth']);

function MaskedInput({
  type,
  value,
  onChange,
  showLabel,
  hideLabel,
}: {
  type: 'text' | 'date';
  value: string;
  onChange: (v: string) => void;
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), 10_000);
    return () => clearTimeout(id);
  }, [visible]);

  const masked = value ? '••••••••' : '';
  const renderType = visible ? type : 'text';
  const renderValue = visible ? value : masked;

  return (
    <div className="relative">
      <input
        type={renderType}
        value={renderValue}
        onChange={(e) => {
          if (!visible) return;
          onChange(e.target.value);
        }}
        onFocus={() => setVisible(true)}
        readOnly={!visible}
        className={INPUT + ' pr-16 font-mono'}
        aria-label={visible ? hideLabel : showLabel}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500 hover:text-slate-900 px-1.5"
      >
        {visible ? hideLabel : showLabel}
      </button>
    </div>
  );
}

export default function VisaSupportForm({ values, errors, labels, onChange }: VisaSupportFormProps) {
  const rows: ReadonlyArray<readonly [string, string, RowType]> = [
    ['legal_name_en', labels.legalName, 'text'],
    ['nationality', labels.nationality, 'country'],
    ['date_of_birth', labels.dateOfBirth, 'date'],
    ['passport_number', labels.passportNumber, 'text'],
    ['passport_country', labels.passportCountry, 'country'],
    ['passport_expiry_date', labels.passportExpiry, 'date'],
    ['planned_arrival_date', labels.arrival, 'date'],
    ['planned_departure_date', labels.departure, 'date'],
    ['taiwan_stay_address', labels.stayAddress, 'textarea'],
    ['destination_mission', labels.destinationMission, 'text'],
  ];

  const showLabel = labels.showSensitive ?? 'Show';
  const hideLabel = labels.hideSensitive ?? 'Hide';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map(([field, label, type]) => {
        const isSensitive = SENSITIVE_FIELDS.has(field);
        return (
          <label key={field} className={field === 'taiwan_stay_address' ? 'sm:col-span-2' : ''}>
            <span className="mb-1 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-slate-500">
              {label}
              {isSensitive ? (
                <span
                  aria-hidden
                  title={labels.sensitiveHint ?? 'Masked by default for privacy'}
                  className="inline-flex items-center text-slate-400"
                >
                  <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="7" width="10" height="6" rx="1" />
                    <path d="M5 7V5a3 3 0 016 0v2" />
                  </svg>
                </span>
              ) : null}
            </span>
            {type === 'textarea' ? (
              <textarea
                value={values[field] ?? ''}
                onChange={(e) => onChange(field, e.target.value)}
                rows={3}
                className={INPUT}
              />
            ) : type === 'country' ? (
              <select
                value={values[field] ?? ''}
                onChange={(e) => onChange(field, e.target.value)}
                className={INPUT}
              >
                <option value="">—</option>
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            ) : isSensitive ? (
              <MaskedInput
                type={type as 'text' | 'date'}
                value={values[field] ?? ''}
                onChange={(v) => onChange(field, v)}
                showLabel={showLabel}
                hideLabel={hideLabel}
              />
            ) : (
              <input
                type={type}
                value={values[field] ?? ''}
                onChange={(e) => onChange(field, e.target.value)}
                className={INPUT}
              />
            )}
            {errors[field] ? <span className="mt-1 block text-xs text-red-500">{errors[field]}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
