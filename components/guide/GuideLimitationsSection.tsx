import type { GuideContent } from '@/data/guide';

export default function GuideLimitationsSection({
  limitations,
}: {
  limitations: GuideContent['limitations'];
}) {
  return (
    <section id="limitations" className="scroll-mt-32 rounded-[28px] border border-stone-200 bg-[#1E1F1C] p-6 text-white sm:p-8">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Notes</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{limitations.title}</h2>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {limitations.items.map((item) => (
          <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-white/70">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
