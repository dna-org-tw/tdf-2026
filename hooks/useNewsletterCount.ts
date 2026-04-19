'use client';

import { useEffect, useState } from 'react';

let cachedValue: number | null = null;
let fetchPromise: Promise<number | null> | null = null;
const subscribers = new Set<(value: number | null) => void>();

async function fetchCount(): Promise<number | null> {
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch('/api/newsletter/count')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (typeof d?.count === 'number' ? d.count : null))
    .catch(() => null);
  const value = await fetchPromise;
  if (value !== null) {
    cachedValue = value;
    subscribers.forEach((cb) => cb(value));
  }
  return value;
}

export function useNewsletterCount() {
  const [count, setCount] = useState<number | null>(cachedValue);
  const [loading, setLoading] = useState<boolean>(cachedValue === null);

  useEffect(() => {
    const sub = (value: number | null) => setCount(value);
    subscribers.add(sub);

    if (cachedValue === null) {
      fetchCount().finally(() => setLoading(false));
    }

    return () => {
      subscribers.delete(sub);
    };
  }, []);

  const increment = () => {
    if (cachedValue !== null) {
      cachedValue += 1;
      subscribers.forEach((cb) => cb(cachedValue));
    }
  };

  return { count, loading, increment };
}
