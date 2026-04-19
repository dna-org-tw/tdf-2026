'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Detect when a referenced element is near the viewport so callers can
 * lazy-mount heavy UI (maps, third-party widgets) or defer data fetches.
 *
 * Uses a callback-style ref + state so the observer attaches correctly
 * even when the host component is rendered via `next/dynamic({ ssr: false })`
 * (mount order where MutableRef + useEffect would otherwise race).
 *
 * The callback fires exactly once; the observer disconnects after the first
 * intersection. Falls back to immediate mount when IntersectionObserver is
 * unavailable (e.g. SSR bailouts, very old browsers).
 */
export function useNearViewport<T extends Element>(rootMargin: string = '400px') {
  const [node, setNode] = useState<T | null>(null);
  const [isNear, setIsNear] = useState(false);

  const ref = useCallback((element: T | null) => {
    setNode(element);
  }, []);

  useEffect(() => {
    if (isNear || !node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsNear(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isNear, node, rootMargin]);

  return { ref, isNear };
}
