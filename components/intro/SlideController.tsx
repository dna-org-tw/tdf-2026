'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface SlideControllerProps {
  totalSlides: number;
  bare?: boolean;
}

export default function SlideController({ totalSlides, bare }: SlideControllerProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [current, setCurrent] = useState(1);
  const searchParams = useSearchParams();
  const isBare = bare ?? searchParams.get('bare') === '1';

  const scrollToSlide = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const slides = container.querySelectorAll<HTMLElement>('[data-slide]');
    slides[index]?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const container = document.getElementById('slide-container');
    if (!container) return;
    containerRef.current = container;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-slide'));
            if (!isNaN(idx)) setCurrent(idx + 1);
          }
        }
      },
      { root: container, threshold: 0.5 }
    );

    const slides = container.querySelectorAll('[data-slide]');
    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const next = ['ArrowDown', 'ArrowRight', ' ', 'PageDown'];
      const prev = ['ArrowUp', 'ArrowLeft', 'PageUp'];
      if (next.includes(e.key)) {
        e.preventDefault();
        if (current < totalSlides) scrollToSlide(current);
      } else if (prev.includes(e.key)) {
        e.preventDefault();
        if (current > 1) scrollToSlide(current - 2);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, totalSlides, scrollToSlide]);

  if (isBare) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 print:hidden">
      <span className="rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm tabular-nums">
        {current} / {totalSlides}
      </span>
    </div>
  );
}
