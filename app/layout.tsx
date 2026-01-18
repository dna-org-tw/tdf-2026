import type { Metadata } from 'next';
import { Inter, Outfit, Noto_Sans_TC } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import 'leaflet/dist/leaflet.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  variable: '--font-noto-sans-tc',
  weight: ['400', '500', '700'],
  display: 'swap',
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
