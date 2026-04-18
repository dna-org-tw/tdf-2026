// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StayHero({ stay }: { stay: any; lang?: string }) {
  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Norden Ruder x TDF</p>
      <h1 className="mt-3 text-4xl font-bold text-slate-900">{stay.title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{stay.subtitle}</p>
    </section>
  );
}
