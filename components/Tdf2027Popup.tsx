'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

const TARGET_URL = 'https://2027.taiwandigitalfest.com';

export default function Tdf2027Popup() {
  const { t } = useTranslation();
  const popup = t.tdf2027Popup;
  // Show on every visit; render only after mount to avoid hydration mismatch.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Defer to avoid calling setState synchronously inside an effect.
    const id = setTimeout(() => setOpen(true), 0);
    return () => clearTimeout(id);
  }, []);

  // Close on Escape and lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={popup?.ariaLabel ?? 'TDF 2027 announcement'}
      className="fixed inset-0 z-[10000] flex items-center justify-center px-4"
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label={popup?.close ?? 'Close'}
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md rounded-2xl bg-[#1E1F1C] text-white shadow-2xl border border-white/10 px-6 py-8 sm:px-8 sm:py-10 text-center">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={popup?.close ?? 'Close'}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-[#10B8D9] to-[#7DD3FC] bg-clip-text text-transparent">
          {popup?.title ?? 'TDF 2027 is coming!'}
        </h2>
        <p className="mt-3 text-sm sm:text-base leading-relaxed text-white/80">
          {popup?.message ??
            'Taiwan Digital Fest returns in 2027. Be the first to know.'}
        </p>

        <a
          href={TARGET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#10B8D9] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0EA5C4] transition-colors"
        >
          {popup?.cta ?? 'Learn more'}
        </a>
      </div>
    </div>
  );
}
