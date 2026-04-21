'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface LumaCookieStatus {
  cookieInvalid: boolean;
  hasCookie: boolean;
  loaded: boolean;
}

const Ctx = createContext<LumaCookieStatus>({
  cookieInvalid: false,
  hasCookie: false,
  loaded: false,
});

const POLL_INTERVAL_MS = 60_000;

export function LumaCookieStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LumaCookieStatus>({
    cookieInvalid: false,
    hasCookie: false,
    loaded: false,
  });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/luma-sync/config', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { cookieInvalid?: boolean; hasCookie?: boolean };
      setStatus({
        cookieInvalid: !!data.cookieInvalid,
        hasCookie: !!data.hasCookie,
        loaded: true,
      });
    } catch {
      // ignore — keep last known status
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchStatus();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchStatus]);

  return <Ctx.Provider value={status}>{children}</Ctx.Provider>;
}

export function useLumaCookieStatus() {
  return useContext(Ctx);
}

export function LumaCookieBanner() {
  const { cookieInvalid, loaded } = useLumaCookieStatus();
  if (!loaded || !cookieInvalid) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-50 border-b border-red-700 bg-red-600 text-white shadow-md"
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm sm:px-6">
        <span className="inline-flex items-center gap-2 font-semibold">
          <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
          Luma session 已失效
        </span>
        <span className="text-red-100">
          自動同步與審核已停擺。請重新從瀏覽器取得 luma.auth-session-key 並更新。
        </span>
        <Link
          href="/admin/luma-sync"
          className="ml-auto rounded-md bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
        >
          前往更新 →
        </Link>
      </div>
    </div>
  );
}
