'use client';

import { Suspense, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HeroSection from '@/components/sections/HeroSection';
import AboutSection from '@/components/sections/AboutSection';
import WhySection from '@/components/sections/WhySection';
import HighlightsSection from '@/components/sections/HighlightsSection';
import TicketTimelineSection from '@/components/sections/TicketTimelineSection';
import PartnersSection from '@/components/sections/PartnersSection';
import AccommodationSection from '@/components/sections/AccommodationSection';

function HomeContent() {
  // Handle hash navigation on page load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      // Wait for all content to load, then scroll
      const timer = setTimeout(() => {
        const element = document.getElementById(hash.replace('#', ''));
        if (element) {
          // Account for navbar height
          const navbarHeight = 80;
          const elementPosition = element.offsetTop - navbarHeight;
          window.scrollTo({ top: elementPosition, behavior: 'smooth' });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <>
      <Navbar />
      <HeroSection />
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

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-stone-50">Loading...</div>}>
        <HomeContent />
      </Suspense>
    </main>
  );
}