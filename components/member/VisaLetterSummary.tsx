'use client';

interface VisaLetterSummaryProps {
  title: string;
  englishHint: string;
  paidLabel: string;
  unpaidLabel: string;
  hasPaidOrder: boolean;
  values: Record<string, string>;
}

export default function VisaLetterSummary({
  title,
  englishHint,
  paidLabel,
  unpaidLabel,
  hasPaidOrder,
  values,
}: VisaLetterSummaryProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-stone-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${hasPaidOrder ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
          {hasPaidOrder ? paidLabel : unpaidLabel}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{englishHint}</p>
      <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        <div><dt className="text-xs uppercase tracking-wide text-slate-400">Name</dt><dd>{values.legal_name_en || '—'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-slate-400">Nationality</dt><dd>{values.nationality || '—'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-slate-400">Travel</dt><dd>{values.planned_arrival_date && values.planned_departure_date ? `${values.planned_arrival_date} → ${values.planned_departure_date}` : '—'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-slate-400">Mission</dt><dd>{values.destination_mission || 'To Whom It May Concern'}</dd></div>
      </dl>
    </div>
  );
}
