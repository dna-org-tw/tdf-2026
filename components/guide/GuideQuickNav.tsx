import type { GuideNavGroup } from '@/data/guide';

export default function GuideQuickNav({ navGroups }: { navGroups: GuideNavGroup[] }) {
  return (
    <div className="-mx-4 border-y border-stone-200 bg-stone-50/95 sm:-mx-6">
      <div className="overflow-x-auto px-4 py-3 sm:px-6">
        <div className="flex min-w-max gap-6">
          {navGroups.map((group) => (
            <div key={group.id} className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
                {group.label}
              </span>
              <div className="flex gap-2">
                {group.items.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-100"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
