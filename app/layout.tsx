import type { Metadata } from 'next';
import { Inter, Outfit, Noto_Sans_TC } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import StructuredData from '@/components/StructuredData';
import ResourceHints from '@/components/ResourceHints';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap', // 使用 swap 避免 FOIT
  preload: true, // 預載入主要字體
  fallback: ['system-ui', 'sans-serif'],
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap', // 使用 swap 避免 FOIT
  fallback: ['system-ui', 'sans-serif'],
});

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  // 中文字體子集化：僅載入常用字元，大幅減少字體檔案體積
  // 如需完整字元集，可移除 subset 限制或使用 preload
  variable: '--font-noto-sans-tc',
  weight: ['400', '500', '700'],
  display: 'swap', // 使用 swap 避免 FOIT，提升 LCP
  preload: true, // 預載入字體以減少 CLS
  // 優化字體載入：使用 font-display: swap 確保文字立即顯示
  fallback: ['system-ui', 'sans-serif'], // 提供 fallback 字體
});

// AEO优化：丰富的元数据，包含关键词和结构化信息
export const metadata: Metadata = {
  title: {
    default: 'Taiwan Digital Fest 2026 | Where Digital Nomads Meet Nature & Innovation',
    template: '%s | Taiwan Digital Fest 2026',
  },
  description: 'Taiwan Digital Fest 2026 is a curated month-long festival for digital nomads in Taitung and Hualien, Taiwan. Join us from May 1-31, 2026 for AI workshops, networking events, and breathtaking natural experiences.',
  keywords: [
    'Taiwan Digital Fest',
    'digital nomad',
    'Taiwan',
    'Taitung',
    'Hualien',
    'remote work',
    'digital nomad festival',
    'AI workshops',
    'placemaking',
    'Taiwan travel',
    'work-life balance',
    '數位遊牧',
    '台灣數位嘉年華',
  ],
  authors: [{ name: 'Taiwan Digital Nomad Association' }],
  creator: 'Taiwan Digital Nomad Association (TDNA)',
  publisher: 'Taiwan Digital Nomad Association',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://fest.dna.org.tw'),
  alternates: {
    canonical: '/',
    languages: {
      'en': '/?lang=en',
      'zh-TW': '/?lang=zh',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['zh_TW'],
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://fest.dna.org.tw',
    siteName: 'Taiwan Digital Fest 2026',
    title: 'Taiwan Digital Fest 2026 | Where Digital Nomads Meet Nature & Innovation',
    description: 'Join us for Taiwan Digital Fest 2026, a curated festival for digital nomads in Taitung and Hualien, Taiwan. May 1-31, 2026.',
    images: [
      {
        url: '/images/tdf2025.webp',
        width: 1200,
        height: 630,
        alt: 'Taiwan Digital Fest 2026',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Taiwan Digital Fest 2026',
    description: 'Where Digital Nomads Meet Nature & Innovation',
    images: ['/images/tdf2025.webp'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // 可以添加Google Search Console验证
    // google: 'your-google-verification-code',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 從 middleware 設置的請求頭讀取語言
  const headersList = await headers();
  const lang = headersList.get('x-lang') || 'zh-TW';
  
  return (
    <html lang={lang} className="scroll-smooth">
      <body
        className={`${inter.variable} ${outfit.variable} ${notoSansTC.variable} font-sans antialiased bg-stone-50 text-slate-900 selection:bg-teal-500 selection:text-white`}
      >
        {/* Performance optimization: Add resource hints for external domains */}
        <ResourceHints />
        {/* AEO优化：添加结构化数据 - Next.js会自动将其移到head */}
        <StructuredData lang={lang === 'zh-TW' ? 'zh' : 'en'} />
        {children}
      </body>
    </html>
  );
}
