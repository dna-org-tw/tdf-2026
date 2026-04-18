// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StayInventoryGrid({ weeks, stay }: { weeks: any[]; stay: any }) {
  return (
    <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Weekly inventory</h2>
      <div className="mt-4 grid gap-3">
        {weeks.map((week) => (
          <article key={week.code} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-slate-900">{week.starts_on} – {week.ends_on}</div>
                <div className="text-sm text-slate-500">Capacity {week.room_capacity}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold text-slate-900">NT${week.price_twd.toLocaleString()}</div>
                <div className="text-xs text-slate-500">{stay.usdApproxNote}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
