'use client';

import { useEffect } from 'react';
import { getUserInfo } from '@/lib/userInfo';
import { getVisitorFingerprint, setVisitorFingerprint } from '@/lib/visitorStorage';

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

/**
 * 進入網頁時自動記錄 visitor：fingerprint、IP、時區、語系等
 * 將 fingerprint 存至 sessionStorage，供訂閱/購買時關聯裝置
 *
 * Deferred until the browser is idle so FingerprintJS loading and the
 * POST /api/visitors/record round-trip do not compete with LCP / TBT.
 */
export default function VisitorTracker() {
  useEffect(() => {
    const recordVisitor = async () => {
      let fingerprint: string | null = getVisitorFingerprint();

      try {
        if (!fingerprint) {
          const { default: FingerprintJS } = await import('@fingerprintjs/fingerprintjs');
          const fp = await FingerprintJS.load();
          const result = await fp.get();
          fingerprint = result.visitorId;
        }

        if (!fingerprint) return;

        const userInfo = getUserInfo();
        const response = await fetch('/api/visitors/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fingerprint,
            timezone: userInfo.timezone,
            locale: userInfo.locale,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          }),
        });

        const data = await response.json();

        if (response.ok && data.visitor_fingerprint) {
          setVisitorFingerprint(data.visitor_fingerprint);
          if (isDev) console.log('[VisitorTracker] 已記錄 visitor:', data.visitor_fingerprint);
        } else {
          console.warn('[VisitorTracker] API 回應異常:', response.status, data?.error, data?.detail);
        }
      } catch (error) {
        console.warn('[VisitorTracker] Failed to record visitor:', error);
      }
    };

    const schedule: (cb: () => void) => void =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 3000 })
        : (cb) => setTimeout(cb, 2000);

    schedule(() => {
      void recordVisitor();
    });
  }, []);

  return null;
}
