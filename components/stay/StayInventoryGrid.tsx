// eslint-disable-next-line @typescript-eslint/no-explicit-any
function remainingBadge(week: any, stay: any) {
  const remaining = typeof week.remaining === 'number' ? week.remaining : null;
  if (remaining === null) return null;
  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
        {stay.soldOutLabel}
      </span>
    );
  }
  const urgent = remaining <= 5;
  const cls = urgent
    ? 'bg-rose-100 text-rose-700 border border-rose-200'
    : 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  return (
    <span className={`inline-flex items-baseline gap-1 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      <span className="text-sm leading-none">{remaining}</span>
      <span>{stay.remainingLabel}</span>
      {urgent && <span className="ml-1 text-[10px] font-bold uppercase tracking-wider">{stay.almostFullLabel}</span>}
    </span>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StayInventoryGrid({ weeks, stay }: { weeks: any[]; stay: any }) {
  return (
    <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{stay.inventoryTitle}</h2>
      <div className="mt-4 grid gap-3">
        {weeks.map((week) => (
          <article key={week.code} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-slate-900">{week.starts_on} – {week.ends_on}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {stay.capacityLabel} {week.room_capacity}
                </div>
                <div className="mt-2">{remainingBadge(week, stay)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400">TWD</div>
                <div className="text-xl font-semibold text-slate-900">${week.price_twd.toLocaleString()}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
