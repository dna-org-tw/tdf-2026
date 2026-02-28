'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const COOKIE_NAME = 'discount_code';
const COOKIE_DAYS = 30;

export default function DiscountCodeCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; expires=${expires}; path=/; SameSite=Lax`;
    }
  }, [searchParams]);

  return null;
}
