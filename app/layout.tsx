import type { Metadata } from 'next';
import { Inter, Outfit, Noto_Sans_TC } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import StructuredData from '@/components/StructuredData';
import PreconnectLinks from '@/components/PreconnectLinks';

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

// SEO Optimization: Rich metadata with core keyword strategy for Western digital nomads
export const metadata: Metadata = {
  title: {
    default: 'Taiwan Digital Fest 2026 | Digital Nomad Event & Remote Work Summit',
    template: '%s | Taiwan Digital Fest 2026',
  },
  description: 'Join Taiwan Digital Fest 2026 - the premier Digital Nomad Event in Taiwan. A month-long remote work summit combining AI workshops, networking events, and authentic cultural experiences in Taitung and Hualien. Connect with the global nomad tribe, learn from industry leaders, and experience geo-arbitrage in Asia\'s hidden gem.',
  keywords: [
    // Primary Keywords (Brand & Event Type)
    'Digital Nomad Event 2026',
    'Remote Work Summit',
    'Location Independent Event',
    'Global Nomad Meetup',
    'Entrepreneurship Event',
    'Freelancer Summit',
    'Online Business Expo',
    // Location + Identity Keywords
    'Taiwan Digital Nomad Event',
    'Taitung Digital Nomad Event',
    'Hualien Digital Nomad Event',
    'Nomad Events in Asia',
    'Best Digital Nomad Destinations 2026',
    'Taiwan Remote Work',
    // Secondary Keywords (LSI & Related Terms)
    'Digital Nomad Community',
    'Remote Work Culture',
    'Networking Event',
    'Speaker Lineup',
    'Geo-arbitrage',
    'Async Work',
    'Bootstrapping',
    'Solopreneur',
    'Indie Hacker',
    'Work-Life Balance',
    'Slow Travel',
    'Nomad Tribe',
    // Location-Specific
    'Cost of living Taiwan',
    'Coworking spaces Taiwan',
    'Visa for digital nomads Taiwan',
    'Internet speed Taiwan',
    'Taiwan digital nomad visa',
    // Ticket/Pricing Keywords
    'Early bird tickets digital nomad',
    'Event Pass',
    'VIP Access',
    'Tax deductible events',
    // Content Keywords
    'Passive Income',
    'SaaS Growth',
    'SEO for Bloggers',
    'Tax Optimization',
    'E-residency',
    'Crypto Nomad',
    // Legacy/Alternative Names
    'Taiwan Digital Fest',
    'Taiwan Digital Fest 2026',
    'TDF 2026',
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
    title: 'Taiwan Digital Fest 2026 | Digital Nomad Event & Remote Work Summit',
    description: 'Join Taiwan Digital Fest 2026 - the premier Digital Nomad Event in Taiwan. Connect with the global nomad tribe, learn from industry leaders, and experience geo-arbitrage in Asia\'s hidden gem. May 1-31, 2026.',
    images: [
      {
        url: '/images/tdf2025.webp',
        width: 1200,
        height: 630,
        alt: 'Digital Nomad Event 2026 Taiwan - Remote Work Summit',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Taiwan Digital Fest 2026 | Digital Nomad Event & Remote Work Summit',
    description: 'Connect with the global nomad tribe. AI workshops, networking, and authentic experiences in Taitung & Hualien.',
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
        {/* Performance optimization: Preconnect to external domains - Next.js will move these to head */}
        <PreconnectLinks />
        {/* AEO优化：添加结构化数据 - Next.js会自动将其移到head */}
        <StructuredData lang={lang === 'zh-TW' ? 'zh' : 'en'} />
        {children}
      </body>
    </html>
  );
}
