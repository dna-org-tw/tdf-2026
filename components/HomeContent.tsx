'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/sections/HeroSection';
import HashNavigationHandler from '@/components/HashNavigationHandler';

// 動態導入非首屏組件，大幅減少初始 bundle 大小
// 使用 loading 狀態提升 UX，並設定 ssr: false 避免不必要的 SSR
const Footer = dynamic(() => import('@/components/Footer'), {
  ssr: false,
  loading: () => null, // Footer 不需要 loading 狀態
});

const AboutSection = dynamic(() => import('@/components/sections/AboutSection'), {
  ssr: false,
  loading: () => <div className="h-96 bg-white animate-pulse" />,
});

const WhySection = dynamic(() => import('@/components/sections/WhySection'), {
  ssr: false,
  loading: () => <div className="h-96 bg-white animate-pulse" />,
});

const HighlightsSection = dynamic(() => import('@/components/sections/HighlightsSection'), {
  ssr: false,
  loading: () => <div className="h-96 bg-stone-100 animate-pulse" />,
});

const TicketTimelineSection = dynamic(() => import('@/components/sections/TicketTimelineSection'), {
  ssr: false,
  loading: () => <div className="h-96 bg-[#1E1F1C] animate-pulse" />,
});

const AccommodationSection = dynamic(() => import('@/components/sections/AccommodationSection'), {
  ssr: false,
  loading: () => <div className="h-96 bg-white animate-pulse" />,
});

const PartnersSection = dynamic(() => import('@/components/sections/PartnersSection'), {
  ssr: false,
  loading: () => <div className="h-96 bg-white animate-pulse" />,
});

export default function HomeContent() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <HashNavigationHandler />
      <AboutSection />
      <WhySection />
      <HighlightsSection />
      <TicketTimelineSection />
      <AccommodationSection />
      <PartnersSection />
      <Footer />
    </>
  );
}
