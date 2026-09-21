import { useSyncExternalStore } from 'react';

export type CookieConsentState = 'accepted' | 'rejected' | 'unknown';

export const COOKIE_CONSENT_KEY = 'tdf_cookie_consent_v1';
export const COOKIE_CONSENT_EVENT = 'tdf:cookie-consent-changed';

export function readCookieConsent(): CookieConsentState {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const v = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (v === 'accepted' || v === 'rejected') return v;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function writeCookieConsent(state: 'accepted' | 'rejected'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, state);
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: state }));
  } catch {
    // localStorage unavailable (private browsing, etc.) — consent stays per-session.
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(COOKIE_CONSENT_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(COOKIE_CONSENT_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

const serverSnapshot = (): CookieConsentState => 'unknown';

export function useCookieConsent(): CookieConsentState {
  return useSyncExternalStore(subscribe, readCookieConsent, serverSnapshot);
}
