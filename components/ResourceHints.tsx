'use client';

import { useEffect } from 'react';

/**
 * Adds resource hints (preconnect/dns-prefetch) for external domains
 * This improves loading performance for YouTube thumbnails and Instagram embeds
 */
export default function ResourceHints() {
  useEffect(() => {
    // Add preconnect for YouTube
    const youtubePreconnect = document.createElement('link');
    youtubePreconnect.rel = 'preconnect';
    youtubePreconnect.href = 'https://www.youtube.com';
    document.head.appendChild(youtubePreconnect);

    // Add preconnect for Instagram
    const instagramPreconnect = document.createElement('link');
    instagramPreconnect.rel = 'preconnect';
    instagramPreconnect.href = 'https://www.instagram.com';
    document.head.appendChild(instagramPreconnect);

    // Add dns-prefetch for YouTube images
    const youtubeDns = document.createElement('link');
    youtubeDns.rel = 'dns-prefetch';
    youtubeDns.href = 'https://img.youtube.com';
    document.head.appendChild(youtubeDns);

    // Add dns-prefetch for Google APIs
    const googleDns = document.createElement('link');
    googleDns.rel = 'dns-prefetch';
    googleDns.href = 'https://www.google.com';
    document.head.appendChild(googleDns);
  }, []);

  return null;
}
