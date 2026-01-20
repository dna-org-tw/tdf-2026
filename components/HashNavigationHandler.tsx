'use client';

import { useEffect } from 'react';

export default function HashNavigationHandler() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      // 使用 requestAnimationFrame 確保 DOM 已渲染
      requestAnimationFrame(() => {
        setTimeout(() => {
          const element = document.getElementById(hash.replace('#', ''));
          if (element) {
            const navbarHeight = 80;
            const elementPosition = element.offsetTop - navbarHeight;
            window.scrollTo({ top: elementPosition, behavior: 'smooth' });
          }
        }, 100);
      });
    }
  }, []);

  return null;
}
