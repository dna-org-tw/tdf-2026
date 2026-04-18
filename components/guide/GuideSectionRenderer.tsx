import type { GuideSection } from '@/data/guide';
import GuideBlockRenderer from './GuideBlockRenderer';

export default function GuideSectionRenderer({ section }: { section: GuideSection }) {
  return (
    <section id={section.id} className="scroll-mt-32 space-y-5 rounded-[28px] border border-stone-200 bg-stone-50 p-6 sm:p-8">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
          {section.label}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">{section.title}</h2>
        {section.intro ? <p className="mt-3 text-sm leading-7 text-stone-600 sm:text-base">{section.intro}</p> : null}
      </div>
      <div className="space-y-5">
        {section.blocks.map((block, index) => (
          <GuideBlockRenderer key={`${section.id}-${index}`} block={block} />
        ))}
      </div>
    </section>
  );
}
