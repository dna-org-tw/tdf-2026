import type { GuideContent } from '@/data/guide';

export default function GuideHero({ guide }: { guide: GuideContent }) {
  return (
    <section className="rounded-[32px] bg-[#1E1F1C] px-6 py-8 text-white sm:px-8 sm:py-10">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">TDF 2026</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{guide.pageTitle}</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/75 sm:text-base">{guide.pageDescription}</p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {guide.entryCards.map((card) => (
          <a
            key={card.id}
            href={`#${card.targetId}`}
            className="rounded-[24px] border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
          >
            <p className="text-lg font-semibold">{card.label}</p>
            <p className="mt-2 text-sm text-white/70">{card.description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
