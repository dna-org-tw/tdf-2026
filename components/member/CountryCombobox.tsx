'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { COUNTRIES_I18N } from '@/lib/countries-i18n';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  lang: 'en' | 'zh';
  inputClassName: string;
  ariaLabel?: string;
}

export default function CountryCombobox({
  value,
  onChange,
  placeholder,
  lang,
  inputClassName,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        if (query !== value) onChange(query.trim());
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, query, value, onChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES_I18N;
    return COUNTRIES_I18N.filter((c) =>
      c.en.toLowerCase().includes(q) || c.zh.includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(Math.max(0, filtered.length - 1));
  }, [filtered.length, highlight]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const commit = (v: string) => {
    onChange(v);
    setQuery(v);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) commit(filtered[highlight].en);
      else commit(query.trim());
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(value);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className={`${inputClassName} pr-9`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
      />
      <ChevronDown
        className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
      />
      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-10"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-slate-400">
              {lang === 'zh' ? `找不到「${query}」，按 Enter 直接使用` : `No match for "${query}" — press Enter to use as-is`}
            </div>
          ) : (
            filtered.map((c, i) => {
              const active = i === highlight;
              const selected = c.en === value;
              return (
                <button
                  key={c.en}
                  type="button"
                  data-idx={i}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(c.en);
                  }}
                  className={`flex items-center justify-between w-full text-left px-3 py-2 text-[13px] ${
                    active ? 'bg-[#10B8D9]/10 text-[#0EA5C4]' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>
                    {lang === 'zh' ? (
                      <>
                        <span className="font-medium">{c.zh}</span>
                        <span className="text-slate-400 ml-1.5 text-[12px]">{c.en}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{c.en}</span>
                        <span className="text-slate-400 ml-1.5 text-[12px]">{c.zh}</span>
                      </>
                    )}
                  </span>
                  {selected && <Check className="w-3.5 h-3.5 text-[#10B8D9]" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
