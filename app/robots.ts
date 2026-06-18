import { MetadataRoute } from 'next';
import { BASE_PATH } from '@/lib/basePath';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.taiwandigitalfest.com/2026';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [`${BASE_PATH}/api/`, `${BASE_PATH}/_next/`],
      },
      // AEO optimization: explicitly allow AI crawlers
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: [`${BASE_PATH}/api/`, `${BASE_PATH}/_next/`],
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: [`${BASE_PATH}/api/`, `${BASE_PATH}/_next/`],
      },
      {
        userAgent: 'CCBot',
        allow: '/',
        disallow: [`${BASE_PATH}/api/`, `${BASE_PATH}/_next/`],
      },
      {
        userAgent: 'anthropic-ai',
        allow: '/',
        disallow: [`${BASE_PATH}/api/`, `${BASE_PATH}/_next/`],
      },
      {
        userAgent: 'Claude-Web',
        allow: '/',
        disallow: [`${BASE_PATH}/api/`, `${BASE_PATH}/_next/`],
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: [`${BASE_PATH}/api/`, `${BASE_PATH}/_next/`],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}