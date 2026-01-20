'use client';

import { useEffect } from 'react';

/**
 * Dynamically loads Leaflet CSS only when needed
 * This reduces initial CSS bundle size by ~50KB
 */
export default function LazyLeafletCSS() {
  useEffect(() => {
    // Check if Leaflet CSS is already loaded
    const existingLink = document.querySelector('link[href*="leaflet"]');
    if (existingLink) return;

    // Dynamically load Leaflet CSS using a link tag
    // This defers loading until the map component is actually rendered
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = 'anonymous';
    link.media = 'print'; // Load with low priority
    link.onload = () => {
      link.media = 'all'; // Switch to all media once loaded
    };
    document.head.appendChild(link);
  }, []);

  return null;
}
