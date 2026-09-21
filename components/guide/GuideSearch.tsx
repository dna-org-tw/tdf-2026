'use client';

import { useMemo, useState } from 'react';
import type { GuideSection } from '@/data/guide';
import type { Language } from '@/data/content';

const WHATSAPP_URL = 'https://chat.whatsapp.com/KZsFo7oNvZVCPIF86imk0E';
const EMAIL = 'fest@dna.org.tw';

const copy = {
  zh: {
    placeholder: '搜尋指南內容，例如「退票」、「簽證」、「轉讓」…',
    empty: '搜尋不到相關內容？',
    emptyHint: '試試看其他關鍵字，或直接問我們：',
    hitInSection: '在',
    noMatches: '沒有找到相符的內容',
    whatsapp: '加入 WhatsApp 社群',
    email: '寄信',
    clear: '清除',
    resultsLabel: (count: number) => `找到 ${count} 個相符段落`,
  },
  en: {
    placeholder: 'Search the guide — try "refund", "visa", "transfer"…',
    empty: "No results for that?",
    emptyHint: 'Try different keywords, or ask us directly:',
    hitInSection: 'in',
    noMatches: 'No matching content',
    whatsapp: 'Join WhatsApp community',
    email: 'Email us',
    clear: 'Clear',
    resultsLabel: (count: number) => `${count} matching passage${count === 1 ? '' : 's'}`,
  },
} as const;

type SearchableEntry = {
  sectionId: string;
  sectionLabel: string;
  sectionTitle: string;
  text: string;
};

function buildIndex(sections: GuideSection[]): SearchableEntry[] {
  const entries: SearchableEntry[] = [];
  for (const section of sections) {
    const sectionMeta = {
      sectionId: section.id,
      sectionLabel: section.label,
      sectionTitle: section.title,
    };
    if (section.intro) {
      entries.push({ ...sectionMeta, text: section.intro });
    }
    for (const block of section.blocks) {
      if (block.type === 'faq') {
        for (const item of block.items) {
          entries.push({ ...sectionMeta, text: `${item.question}\n${item.answer}` });
        }
      } else if (block.type === 'feature-list' || block.type === 'steps') {
        for (const item of block.items) {
          entries.push({ ...sectionMeta, text: `${item.title}\n${item.body}` });
        }
      } else if (block.type === 'callout') {
        entries.push({ ...sectionMeta, text: `${block.title ?? ''}\n${block.body}` });
      } else if (block.type === 'table') {
        entries.push({
          ...sectionMeta,
          text: [block.columns.join(' '), ...block.rows.map((row) => row.join(' '))].join('\n'),
        });
      } else if (block.type === 'checklist') {
        entries.push({ ...sectionMeta, text: block.items.join('\n') });
      }
    }
  }
  return entries;
}

function snippet(text: string, q: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return text.slice(0, 120);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + q.length + 80);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export default function GuideSearch({
  sections,
  lang,
}: {
  sections: GuideSection[];
  lang: Language;
}) {
  const t = copy[lang];
  const [query, setQuery] = useState('');
  const entries = useMemo(() => buildIndex(sections), [sections]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return entries.filter((e) => e.text.toLowerCase().includes(q)).slice(0, 8);
  }, [entries, query]);

  const showEmpty = query.trim().length >= 2 && results.length === 0;
  const q = query.trim();

  const handleResultClick = (sectionId: string) => {
    setQuery('');
    const target = document.getElementById(sectionId);
    if (!target) return;
    window.history.replaceState(null, '', `#${sectionId}`);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.querySelectorAll('details').forEach((d) => {
      if (d.textContent?.toLowerCase().includes(q.toLowerCase())) d.setAttribute('open', '');
    });
  };

  return (
    <div className="relative">
      <label className="relative block">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.placeholder}
          className="w-full rounded-full border border-stone-200 bg-white py-3 pl-12 pr-4 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none sm:text-base"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100"
          >
            {t.clear}
          </button>
        )}
      </label>

      {(results.length > 0 || showEmpty) && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
          {results.length > 0 ? (
            <>
              <p className="border-b border-stone-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                {t.resultsLabel(results.length)}
              </p>
              <ul className="max-h-[60vh] overflow-y-auto">
                {results.map((r, i) => (
                  <li key={`${r.sectionId}-${i}`}>
                    <button
                      type="button"
                      onClick={() => handleResultClick(r.sectionId)}
                      className="block w-full border-b border-stone-100 px-4 py-3 text-left transition hover:bg-stone-50 last:border-b-0"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                        {r.sectionLabel}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-stone-900">{r.sectionTitle}</p>
                      <p className="mt-1 text-xs leading-5 text-stone-500 line-clamp-2">
                        {snippet(r.text, q)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="p-4">
              <p className="text-sm font-semibold text-stone-900">{t.empty}</p>
              <p className="mt-1 text-sm text-stone-600">{t.emptyHint}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1fb858]"
                >
                  {t.whatsapp}
                </a>
                <a
                  href={`mailto:${EMAIL}`}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
                >
                  {t.email}（{EMAIL}）
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
