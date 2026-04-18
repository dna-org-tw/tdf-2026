'use client';

interface VisaSupportFormProps {
  values: Record<string, string>;
  errors: Partial<Record<string, string>>;
  labels: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

const INPUT = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10B8D9]';

export default function VisaSupportForm({ values, errors, labels, onChange }: VisaSupportFormProps) {
  const rows = [
    ['legal_name_en', labels.legalName, 'text'],
    ['nationality', labels.nationality, 'text'],
    ['date_of_birth', labels.dateOfBirth, 'date'],
    ['passport_number', labels.passportNumber, 'text'],
    ['passport_country', labels.passportCountry, 'text'],
    ['passport_expiry_date', labels.passportExpiry, 'date'],
    ['planned_arrival_date', labels.arrival, 'date'],
    ['planned_departure_date', labels.departure, 'date'],
    ['taiwan_stay_address', labels.stayAddress, 'textarea'],
    ['destination_mission', labels.destinationMission, 'text'],
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map(([field, label, type]) => (
        <label key={field} className={field === 'taiwan_stay_address' ? 'sm:col-span-2' : ''}>
          <span className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
          {type === 'textarea' ? (
            <textarea
              value={values[field] ?? ''}
              onChange={(e) => onChange(field, e.target.value)}
              rows={3}
              className={INPUT}
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
      ))}
    </div>
  );
}
