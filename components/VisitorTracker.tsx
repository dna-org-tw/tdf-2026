'use client';

import { useEffect } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { getUserInfo } from '@/lib/userInfo';
import { getVisitorFingerprint, setVisitorFingerprint } from '@/lib/visitorStorage';

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

/**
 * 進入網頁時自動記錄 visitor：fingerprint、IP、時區、語系等
 * 將 fingerprint 存至 sessionStorage，供訂閱/購買時關聯裝置
 */
export default function VisitorTracker() {
  useEffect(() => {
    const recordVisitor = async () => {
      let fingerprint: string | null = getVisitorFingerprint();

      try {
        if (!fingerprint) {
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

    recordVisitor();
  }, []);

  return null;
}
