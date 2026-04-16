import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Taiwan Digital Fest 2026',
    short_name: 'TDF 2026',
    description:
      'A month-long digital nomad festival in Taitung & Hualien, Taiwan. May 2026.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafaf9', // stone-50
    theme_color: '#0d9488', // teal-600
    icons: [
      {
        src: '/images/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/images/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/images/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
