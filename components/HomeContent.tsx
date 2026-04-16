'use client';

import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/sections/HeroSection';
import HashNavigationHandler from '@/components/HashNavigationHandler';
import { useScrollDepth } from '@/hooks/useScrollDepth';
import { LumaDataProvider } from '@/contexts/LumaDataContext';
import TeamSection from '@/components/sections/TeamSection';

// Dynamically import below-the-fold components to significantly reduce initial bundle size
// Use loading states for better UX, and set ssr: false to avoid unnecessary SSR
const Footer = dynamic(() => import('@/components/Footer'), {
  ssr: false,
  loading: () => null, // Footer doesn't need a loading state
});

// AEO optimization: enable SSR so AI crawlers can access content
// Key content sections use SSR for better AI accessibility and SEO performance
const AboutSection = dynamic(() => import('@/components/sections/AboutSection'), {
  ssr: true, // AEO optimization: enable SSR
  loading: () => <div className="h-96 bg-white animate-pulse" />,
});

const EventsSection = dynamic(() => import('@/components/sections/EventsSection'), {
  ssr: true, // AEO optimization: enable SSR
  loading: () => <div className="h-96 bg-stone-100 animate-pulse" />,
});

const TicketsSection = dynamic(() => import('@/components/sections/TicketsSection'), {
  ssr: true, // AEO optimization: enable SSR
  loading: () => <div className="h-96 bg-[#1E1F1C] animate-pulse" />,
});

const NewsSection = dynamic(() => import('@/components/sections/NewsSection'), {
  ssr: true,
  loading: () => <div className="h-96 bg-stone-50 animate-pulse" />,
});

const AccommodationSection = dynamic(() => import('@/components/sections/AccommodationSection'), {
  ssr: true, // AEO optimization: enable SSR
  loading: () => <div className="h-96 bg-white animate-pulse" />,
});

const FAQSection = dynamic(() => import('@/components/sections/FAQSection'), {
  ssr: true,
  loading: () => <div className="h-96 bg-stone-50 animate-pulse" />,
});

const CommunitySection = dynamic(() => import('@/components/sections/CommunitySection'), {
  ssr: false,
  loading: () => <div className="h-96 bg-[#1E1F1C] animate-pulse" />,
});

const FollowUsSection = dynamic(() => import('@/components/sections/FollowUsSection'), {
  ssr: true, // AEO optimization: enable SSR
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
      <TicketsSection />
      <EventsSection />
      <NewsSection />
      <AccommodationSection />
      <FAQSection />
      <TeamSection />
      <CommunitySection />
      <FollowUsSection />
      <Footer />
    </LumaDataProvider>
  );
}
