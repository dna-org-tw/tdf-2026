'use client';

import { useEffect } from 'react';

export default function HashNavigationHandler() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      // Use requestAnimationFrame to ensure DOM has rendered
      requestAnimationFrame(() => {
        setTimeout(() => {
          const element = document.getElementById(hash.replace('#', ''));
          if (element) {
            // Get navbar height and subtract 4x navbar height as negative offset
            const navbarElement = document.querySelector('nav');
            const navbarHeight = navbarElement ? navbarElement.offsetHeight : 80;
            const extraOffset = navbarHeight * 1; // 1x navbar height as negative offset
            const scrollPosition = element.offsetTop - extraOffset;
            window.scrollTo({ top: Math.max(0, scrollPosition), behavior: 'smooth' });
          }
        }, 100);
      });
    }
  }, []);

  return null;
}
