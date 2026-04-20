'use client';

import { useTranslation } from '@/hooks/useTranslation';

export default function SkipLink() {
  const { t } = useTranslation();
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.querySelector<HTMLElement>('main');
    if (!target) return;
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: false });
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
  };

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="
        sr-only focus:not-sr-only
        focus:fixed focus:top-4 focus:left-4 focus:z-[10000]
        focus:px-4 focus:py-2 focus:rounded-lg
        focus:bg-[#10B8D9] focus:text-white focus:font-semibold
        focus:shadow-2xl focus:outline focus:outline-2 focus:outline-white
      "
    >
      {t.a11y?.skipToContent ?? 'Skip to main content'}
    </a>
  );
}
