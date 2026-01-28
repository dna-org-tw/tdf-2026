'use client';

import { useEffect, useRef } from 'react';
import { trackEvent, trackCustomEvent } from '@/components/FacebookPixel';

interface UseSectionTrackingOptions {
  sectionId: string;
  sectionName: string;
  category?: string;
}

/**
 * Hook to track when a section enters the viewport
 * Uses IntersectionObserver to detect when section is viewed
 */
export function useSectionTracking({ sectionId, sectionName, category = 'Page Section' }: UseSectionTrackingOptions) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const hasTracked = useRef(false);

  useEffect(() => {
    // Find the section element by ID
    const element = document.getElementById(sectionId);
    if (!element) return;

    sectionRef.current = element;

    // Create IntersectionObserver
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Track when section becomes visible (at least 50% visible)
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !hasTracked.current) {
            hasTracked.current = true;
            
            trackEvent('ViewContent', {
              content_name: sectionName,
              content_category: category,
              content_type: 'section',
            });
            
            trackCustomEvent('SectionView', {
              section_id: sectionId,
              section_name: sectionName,
            });
          }
        });
      },
      {
        threshold: 0.5, // Trigger when 50% of section is visible
        rootMargin: '-50px', // Start tracking slightly before section enters viewport
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [sectionId, sectionName, category]);

  return sectionRef;
}
