'use client';

import { useCallback } from 'react';

const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

async function waitForGrecaptchaEnterprise(timeoutMs: number = 8000): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('reCAPTCHA can only be executed in the browser.');
  }
  const start = Date.now();
  // grecaptcha.enterprise.ready(() => ...) resolves once the enterprise runtime
  // is ready. Poll since the script is loaded with strategy="lazyOnload".
  while (Date.now() - start < timeoutMs) {
    const ready = window.grecaptcha?.enterprise?.ready;
    if (typeof ready === 'function') {
      return new Promise<void>((resolve) => {
        ready(resolve);
      });
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('reCAPTCHA did not load in time. Please try again.');
}

/**
 * Hook to execute reCAPTCHA Enterprise verification
 * @param action - The action name for reCAPTCHA (default: 'subscribe')
 * @returns A function that executes reCAPTCHA and returns the token
 */
export function useRecaptcha(action: string = 'subscribe') {
  const executeRecaptcha = useCallback(async (): Promise<string | null> => {
    if (!recaptchaSiteKey) {
      throw new Error('reCAPTCHA is not configured. Please set NEXT_PUBLIC_RECAPTCHA_SITE_KEY.');
    }

    try {
      // Script is loaded with strategy="lazyOnload" to reduce first-load cost;
      // wait for it to be ready when the form is actually submitted.
      await waitForGrecaptchaEnterprise();

      if (typeof window === 'undefined' || !window.grecaptcha?.enterprise) {
        throw new Error('reCAPTCHA is not loaded. Please refresh the page.');
      }

      const token = await window.grecaptcha.enterprise.execute(recaptchaSiteKey, {
        action,
      });

      return token;
    } catch (error) {
      console.error('reCAPTCHA execution failed:', error);
      throw error;
    }
  }, [action]);

  return { executeRecaptcha };
}
