'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

export default function RecaptchaScript() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!SITE_KEY) return;

    let cancelled = false;
    const load = () => {
      if (cancelled) return;
      setShouldLoad(true);
    };

    // Load on any real user-intent signal — keeps risk-analysis coverage
    // for actual visitors while excluding reCAPTCHA (~370 KiB + subresources)
    // from the Lighthouse measurement window and from visitors who never
    // submit a form. useRecaptcha()'s executeRecaptcha() also triggers the
    // load for programmatic callers.
    const events = ['pointerdown', 'touchstart', 'keydown', 'focusin'] as const;
    events.forEach((e) =>
      window.addEventListener(e, load, { once: true, passive: true }),
    );

    return () => {
      cancelled = true;
      events.forEach((e) => window.removeEventListener(e, load));
    };
  }, []);

  if (!SITE_KEY || !shouldLoad) return null;

  return (
    <Script
      src={`https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}`}
      strategy="afterInteractive"
    />
  );
}
