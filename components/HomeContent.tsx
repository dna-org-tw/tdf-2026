'use client';

import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/sections/HeroSection';
import HashNavigationHandler from '@/components/HashNavigationHandler';
import { useScrollDepth } from '@/hooks/useScrollDepth';
import { LumaDataProvider } from '@/contexts/LumaDataContext';
import TeamSection from '@/components/sections/TeamSection';

// 動態導入非首屏組件，大幅減少初始 bundle 大小
// 使用 loading 狀態提升 UX，並設定 ssr: false 避免不必要的 SSR
const Footer = dynamic(() => import('@/components/Footer'), {
  ssr: false,
  loading: () => null, // Footer 不需要 loading 狀態
});

// AEO 優化：啟用 SSR 以確保 AI 爬蟲可以存取內容
// 關鍵內容區域使用 SSR，提升 AI 可存取性和 SEO 表現
const AboutSection = dynamic(() => import('@/components/sections/AboutSection'), {
  ssr: true, // AEO 優化：啟用 SSR
  loading: () => <div className="h-96 bg-white animate-pulse" />,
});

const EventsSection = dynamic(() => import('@/components/sections/EventsSection'), {
  ssr: true, // AEO 優化：啟用 SSR
  loading: () => <div className="h-96 bg-stone-100 animate-pulse" />,
});

const TicketsSection = dynamic(() => import('@/components/sections/TicketsSection'), {
  ssr: true, // AEO 優化：啟用 SSR
  loading: () => <div className="h-96 bg-[#1E1F1C] animate-pulse" />,
});

const AccommodationSection = dynamic(() => import('@/components/sections/AccommodationSection'), {
  ssr: true, // AEO 優化：啟用 SSR
  loading: () => <div className="h-96 bg-white animate-pulse" />,
});

const FollowUsSection = dynamic(() => import('@/components/sections/FollowUsSection'), {
  ssr: true, // AEO 優化：啟用 SSR
  loading: () => <div className="h-96 bg-[#1E1F1C] animate-pulse" />,
});

export default function HomeContent() {
  // Track scroll depth
  useScrollDepth();

  return (
    <LumaDataProvider>
      <Navbar />
      <HeroSection />
      <HashNavigationHandler />
      <AboutSection />
      <EventsSection />
      <TicketsSection />
      <AccommodationSection />
      <TeamSection />
      <FollowUsSection />
      <Footer />
    </LumaDataProvider>
  );
}
