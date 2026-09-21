/**
 * Client-side visitor fingerprint storage
 * 使用 sessionStorage 存儲 fingerprint，同一 session 內訂閱/購買時關聯裝置
 */

const VISITOR_FINGERPRINT_KEY = 'tdf_visitor_fingerprint';

export function getVisitorFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(VISITOR_FINGERPRINT_KEY);
  } catch {
    return null;
  }
}

export function setVisitorFingerprint(fingerprint: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(VISITOR_FINGERPRINT_KEY, fingerprint);
  } catch {
    // Ignore storage errors
  }
}
