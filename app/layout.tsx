import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter, Outfit, Noto_Sans_TC } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import StructuredData from '@/components/StructuredData';
import PreconnectLinks from '@/components/PreconnectLinks';
import FacebookPixel from '@/components/FacebookPixel';
import GoogleTag from '@/components/GoogleTag';
import RecaptchaScript from '@/components/RecaptchaScript';
import VisitorTracker from '@/components/VisitorTracker';
import DiscountCodeCapture from '@/components/DiscountCodeCapture';
import { AuthProvider } from '@/contexts/AuthContext';

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
    default: 'Taiwan Digital Fest 2026 | Nomad Festival',
    template: '%s | Taiwan Digital Fest 2026',
  },
  description: 'Taiwan Digital Fest 2026: a month-long nomad festival in Taitung & Hualien, May 2026. Workshops, networking, and cultural experiences for remote workers.',
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
  authors: [{ name: 'Taiwan Digital Nomad Association', url: 'https://dna.org.tw' }],
  creator: 'Taiwan Digital Nomad Association (TDNA)',
  publisher: 'Taiwan Digital Nomad Association',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://fest.dna.org.tw'),
  alternates: {
    canonical: 'https://fest.dna.org.tw/',
    languages: {
      'en': 'https://fest.dna.org.tw/?lang=en',
      'zh-TW': 'https://fest.dna.org.tw/?lang=zh',
      'x-default': 'https://fest.dna.org.tw/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['zh_TW'],
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://fest.dna.org.tw',
    siteName: 'Taiwan Digital Fest 2026',
    title: 'Taiwan Digital Fest 2026',
    description: 'Nomad festival in Taitung & Hualien, Taiwan. May 2026.',
    images: [
      {
        url: '/images/tdf2026_cover.webp',
        width: 1200,
        height: 630,
        alt: 'Taiwan Digital Fest 2026 — Nomad Festival in Taitung & Hualien',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@taiwandigitalfest',
    creator: '@taiwandigitalfest',
    title: 'Taiwan Digital Fest 2026',
    description: 'Taiwan Digital Fest 2026 is a month-long digital nomad festival in Taitung & Hualien, Taiwan. Join workshops, networking events, cultural experiences, and a remote work summit. May 1–31, 2026.',
    images: ['/images/tdf2026_cover.webp'],
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
    // 可新增 Google Search Console 驗證
    // google: 'your-google-verification-code',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 從 proxy 設置的請求頭讀取語言
  const headersList = await headers();
  const lang = headersList.get('x-lang') || 'en';
  
  return (
    <html lang={lang} className="scroll-smooth">
      <body
        className={`${inter.variable} ${outfit.variable} ${notoSansTC.variable} font-sans antialiased bg-stone-50 text-slate-900 selection:bg-teal-500 selection:text-white`}
      >
        {/* Performance optimization: Preconnect to external domains - Next.js will move these to head */}
        <PreconnectLinks />
        {/* AEO 優化：新增結構化資料 - Next.js 會自動將其移到 head */}
        <StructuredData lang={lang === 'zh-TW' ? 'zh' : 'en'} />
        {/* Facebook Pixel 追踪 */}
        <FacebookPixel />
        {/* Google Tag (gtag.js) - Google Ads AW-17947994689 */}
        <GoogleTag />
        {/* reCAPTCHA Enterprise API */}
        <RecaptchaScript />
        {/* 自動記錄 visitor：fingerprint、IP、時區、語系，供訂閱/購買關聯 */}
        <VisitorTracker />
        {/* 捕捉 URL ?code=xxx 折扣碼並存入 cookie */}
        <Suspense>
          <DiscountCodeCapture />
        </Suspense>
        <AuthProvider>
        {children}
        </AuthProvider>
        {/* SEO: 為無 JavaScript 的爬蟲提供基本內容 */}
        <noscript>
          <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1>Taiwan Digital Fest 2026</h1>
            <p>Join Taiwan Digital Fest 2026 — a month-long digital nomad event in Taitung and Hualien, Taiwan. May 1–31, 2026.</p>
            <p>AI workshops, networking events, cultural experiences, and a remote work summit for digital nomads, freelancers, and location-independent professionals.</p>
            <h2>About the Event</h2>
            <p>Taiwan Digital Fest brings together the global nomad community for a month of learning, connecting, and exploring Taiwan&apos;s east coast. Experience world-class coworking, stunning landscapes, and a vibrant digital nomad community.</p>
            <h2>What to Expect</h2>
            <ul>
              <li>AI and remote work workshops</li>
              <li>Networking events and meetups</li>
              <li>Cultural immersion experiences</li>
              <li>Accommodation in Taitung and Hualien</li>
              <li>Nomad Award — Instagram Reels contest</li>
            </ul>
            <p>Visit <a href="https://fest.dna.org.tw">fest.dna.org.tw</a> with JavaScript enabled for the full experience.</p>
          </div>
        </noscript>
      </body>
    </html>
  );
}
