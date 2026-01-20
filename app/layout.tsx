import type { Metadata } from 'next';
import { Inter, Outfit, Noto_Sans_TC } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import 'leaflet/dist/leaflet.css';

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

export const metadata: Metadata = {
  title: 'Taiwan Digital Fest 2026',
  description: 'Where Digital Nomads Meet Nature & Innovation',
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
        {children}
      </body>
    </html>
  );
}
