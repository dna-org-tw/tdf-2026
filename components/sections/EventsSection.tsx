'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent, trackCustomEvent } from '@/components/FacebookPixel';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import ScheduleModal from '@/components/ScheduleModal';

interface TicketInfo {
  follower: { free: boolean; price?: number };
  explorer: { free: boolean; price?: number };
  contributor: { free: boolean; price?: number };
  backer: { free: boolean; price?: number };
}

interface CalendarEvent {
  title: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string | null;
  startTime?: string | null;
  eligibility?: string[];
  tags?: Array<{ name: string; color?: string }>;
  url?: string;
  tickets?: TicketInfo;
  imageUrl?: string;
}

export default function EventsSection() {
  const { t } = useTranslation();
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  
  // 三行轮播，每行独立的 motion value 和 animation ref
  const x1 = useMotionValue(0);
  const x2 = useMotionValue(0);
  const x3 = useMotionValue(0);
  const animationRef1 = useRef<number | null>(null);
  const animationRef2 = useRef<number | null>(null);
  const animationRef3 = useRef<number | null>(null);
  const initializedRef2 = useRef(false);
  const initializedRef3 = useRef(false);
  
  useSectionTracking({ sectionId: 'events', sectionName: 'Events Section', category: 'Event Information' });

  // Fetch Luma calendar data
  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        const response = await fetch('/api/luma-schedule');
        if (response.ok) {
          const data = await response.json();
          const events = data.events || [];
          // Filter events that have URLs (more likely to have images)
          const filteredEvents = events
            .filter((event: CalendarEvent) => event.url && event.title);
          setAllEvents(filteredEvents);
        }
      } catch (error) {
        console.error('Failed to fetch calendar data:', error);
      }
    };

    fetchCalendarData();
  }, []);

  // Get the lowest tier ticket type from event tags
  // Ticket tier hierarchy (lowest to highest): follower < explorer < contributor < backer
  const getLowestTicketTier = (event: CalendarEvent): string | null => {
    // Get tag names from tags array (preferred) or fallback to eligibility
    const tagsFromTags = event.tags?.map(tag => tag.name.toLowerCase()) || [];
    const tagsFromEligibility = event.eligibility?.map(tag => tag.toLowerCase().replace('#', '')) || [];
    const tagNames = tagsFromTags.length > 0 ? tagsFromTags : tagsFromEligibility;
    
    // Check for ticket tier tags in order from lowest to highest
    const tierOrder = ['follower', 'explorer', 'contributor', 'backer'];
    
    for (const tier of tierOrder) {
      if (tagNames.includes(tier)) {
        return tier;
      }
    }
    
    // If no tier tag found, return null (will be categorized as "other")
    return null;
  };

  // Remove duplicate events by title (case-insensitive)
  const uniqueEvents = allEvents.filter((event, index, self) =>
    index === self.findIndex(e => 
      e.title.toLowerCase().trim() === event.title.toLowerCase().trim()
    )
  );

  // Categorize events by their lowest ticket tier
  const row1Events: CalendarEvent[] = []; // #backer and #contributor (largest)
  const row2Events: CalendarEvent[] = []; // #explorer and #follower (medium)
  const row3Events: CalendarEvent[] = []; // Others (smallest)
  
  uniqueEvents.forEach((event) => {
    const lowestTier = getLowestTicketTier(event);
    
    if (lowestTier === 'backer' || lowestTier === 'contributor') {
      row1Events.push(event);
    } else if (lowestTier === 'explorer' || lowestTier === 'follower') {
      row2Events.push(event);
    } else {
      // no tier tag or other -> row 3
      row3Events.push(event);
    }
  });

  // Debug: Log event distribution
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('Event distribution:', {
      row1: row1Events.length,
      row2: row2Events.length,
      row3: row3Events.length,
      total: allEvents.length,
      unique: uniqueEvents.length
    });
  }

  // Calculate carousel dimensions based on row index
  // Row 1 (largest): sm: 200px, md: 240px, lg: 280px
  // Row 2 (medium): sm: 140px, md: 170px, lg: 200px
  // Row 3 (smallest): sm: 110px, md: 130px, lg: 160px
  const getEventWidth = (rowIndex: number) => {
    if (typeof window === 'undefined') {
      // Default values for SSR
      if (rowIndex === 1) return 200 + 20;
      if (rowIndex === 2) return 140 + 20;
      return 110 + 20; // Row 3
    }
    
    if (window.innerWidth >= 1024) {
      // lg breakpoint
      if (rowIndex === 1) return 280 + 24; // Row 1: largest
      if (rowIndex === 2) return 200 + 24; // Row 2: medium
      return 160 + 24; // Row 3: smallest
    }
    if (window.innerWidth >= 768) {
      // md breakpoint
      if (rowIndex === 1) return 240 + 24;
      if (rowIndex === 2) return 170 + 24;
      return 130 + 24; // Row 3
    }
    // sm breakpoint
    if (rowIndex === 1) return 200 + 20;
    if (rowIndex === 2) return 140 + 20;
    return 110 + 20; // Row 3
  };

  // Handle infinite scroll reset for each row - seamless loop
  useEffect(() => {
    const unsubscribe1 = x1.on('change', (latest) => {
      if (row1Events.length > 0) {
        const eventWidth = getEventWidth(1);
        const singleSetWidth = eventWidth * row1Events.length;
        // Reset when we've moved one full set, seamlessly loop back
        if (latest <= -singleSetWidth) {
          x1.set(latest + singleSetWidth);
        }
      }
    });
    
    const unsubscribe2 = x2.on('change', (latest) => {
      if (row2Events.length > 0) {
        const eventWidth = getEventWidth(2);
        const singleSetWidth = eventWidth * row2Events.length;
        // Reset when we've moved one full set, seamlessly loop back
        if (latest <= -singleSetWidth) {
          x2.set(latest + singleSetWidth);
        }
      }
    });

    const unsubscribe3 = x3.on('change', (latest) => {
      if (row3Events.length > 0) {
        const eventWidth = getEventWidth(3);
        const singleSetWidth = eventWidth * row3Events.length;
        // Reset when we've moved one full set, seamlessly loop back
        if (latest <= -singleSetWidth) {
          x3.set(latest + singleSetWidth);
        }
      }
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    };
  }, [row1Events.length, row2Events.length, row3Events.length, x1, x2, x3]);

  // Auto-scroll animation for row 1 (40s)
  useEffect(() => {
    if (row1Events.length === 0) {
      if (animationRef1.current) {
        const currentAnimation = animationRef1.current as any;
        if (currentAnimation && typeof currentAnimation.stop === 'function') {
          currentAnimation.stop();
        }
        animationRef1.current = null;
      }
      return;
    }

    const startAnimation = () => {
      if (row1Events.length === 0) return;
      
      const eventWidth = getEventWidth(1);
      const singleSetWidth = eventWidth * row1Events.length;
      const currentX = x1.get();
      const targetX = currentX - singleSetWidth;
      const duration = 40; // 40 seconds for one cycle
      
      const animation = animate(x1, targetX, {
        duration,
        ease: 'linear',
        onComplete: () => {
          // Reset will be handled by the change listener for seamless loop
          startAnimation();
        },
      });

      animationRef1.current = animation as unknown as number;
    };

    startAnimation();

    return () => {
      if (animationRef1.current) {
        const currentAnimation = animationRef1.current as any;
        if (currentAnimation && typeof currentAnimation.stop === 'function') {
          currentAnimation.stop();
        }
        animationRef1.current = null;
      }
    };
  }, [row1Events.length, x1]);

  // Auto-scroll animation for row 2 (45s, offset start)
  useEffect(() => {
    if (row2Events.length === 0) return;

    // Set initial offset position for row 2 (only once)
    if (!initializedRef2.current) {
      const eventWidth = getEventWidth(2);
      const singleSetWidth = eventWidth * row2Events.length;
      const initialOffset = -(singleSetWidth * 0.3); // Offset by 30% of one set
      x2.set(initialOffset);
      initializedRef2.current = true;
    }

    const startAnimation = () => {
      if (row2Events.length === 0) return;
      
      const eventWidth = getEventWidth(2);
      const singleSetWidth = eventWidth * row2Events.length;
      const currentX = x2.get();
      const targetX = currentX - singleSetWidth;
      const duration = 45; // 45 seconds for one cycle
      
      const animation = animate(x2, targetX, {
        duration,
        ease: 'linear',
        onComplete: () => {
          // Reset will be handled by the change listener for seamless loop
          startAnimation();
        },
      });

      animationRef2.current = animation as unknown as number;
    };

    startAnimation();

    return () => {
      if (animationRef2.current) {
        const currentAnimation = animationRef2.current as any;
        if (currentAnimation && typeof currentAnimation.stop === 'function') {
          currentAnimation.stop();
        }
        animationRef2.current = null;
      }
    };
  }, [row2Events.length, x2]);

  // Auto-scroll animation for row 3 (50s, offset start)
  useEffect(() => {
    if (row3Events.length === 0) {
      if (animationRef3.current) {
        const currentAnimation = animationRef3.current as any;
        if (currentAnimation && typeof currentAnimation.stop === 'function') {
          currentAnimation.stop();
        }
        animationRef3.current = null;
      }
      return;
    }

    // Set initial offset position for row 3 (only once)
    if (!initializedRef3.current) {
      const eventWidth = getEventWidth(3);
      const singleSetWidth = eventWidth * row3Events.length;
      const initialOffset = -(singleSetWidth * 0.5); // Offset by 50% of one set
      x3.set(initialOffset);
      initializedRef3.current = true;
    }

    const startAnimation = () => {
      if (row3Events.length === 0) return;
      
      const eventWidth = getEventWidth(3);
      const singleSetWidth = eventWidth * row3Events.length;
      const currentX = x3.get();
      const targetX = currentX - singleSetWidth;
      const duration = 50; // 50 seconds for one cycle
      
      const animation = animate(x3, targetX, {
        duration,
        ease: 'linear',
        onComplete: () => {
          // Reset will be handled by the change listener for seamless loop
          startAnimation();
        },
      });

      animationRef3.current = animation as unknown as number;
    };

    startAnimation();

    return () => {
      if (animationRef3.current) {
        const currentAnimation = animationRef3.current as any;
        if (currentAnimation && typeof currentAnimation.stop === 'function') {
          currentAnimation.stop();
        }
        animationRef3.current = null;
      }
    };
  }, [row3Events.length, x3]);


  // Get gradient color based on ticket tier
  const getGradientColor = (tickets?: TicketInfo): string => {
    if (!tickets) {
      return 'from-gray-400 via-gray-500 to-gray-600';
    }

    if (tickets.follower?.free) {
      return 'from-purple-400 via-purple-500 to-purple-600';
    }
    if (tickets.explorer?.free) {
      return 'from-[#10B8D9] via-[#0EA5C9] to-[#0D8FB8]';
    }
    if (tickets.contributor?.free) {
      return 'from-[#00993E] via-[#008030] to-[#006F28]';
    }
    if (tickets.backer?.free) {
      return 'from-[#FFD028] via-[#FFC107] to-[#FFB300]';
    }
    return 'from-gray-400 via-gray-500 to-gray-600';
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.url) {
      trackEvent('Lead', {
        content_name: 'Luma Event Link',
        content_category: 'Event Carousel',
      });
      trackCustomEvent('EventCarouselClick', {
        event_title: event.title,
        event_url: event.url,
        location: 'events_section',
      });
      window.open(event.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Render carousel row component
  const renderCarouselRow = (x: any, rowIndex: number, events: CalendarEvent[]) => {
    // Don't render if no events
    if (events.length === 0) return null;
    
    // Duplicate events multiple times for seamless infinite scroll (at least 3 sets)
    const duplicatedEvents = [...events, ...events, ...events];
    
    return (
    <div
      key={rowIndex}
      className="relative mb-6 md:mb-8 w-full"
    >
      {/* Gradient Overlays */}
      <div className="absolute left-0 top-0 bottom-0 w-32 md:w-48 z-10 bg-gradient-to-r from-stone-100 via-stone-100/80 to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 md:w-48 z-10 bg-gradient-to-l from-stone-100 via-stone-100/80 to-transparent pointer-events-none" />

      {/* Carousel */}
      <div className="overflow-hidden w-full">
        <motion.div
          className="flex gap-6 md:gap-8 pl-4 md:pl-6"
          style={{
            width: 'max-content',
            x,
          }}
        >
          {duplicatedEvents.map((event, index) => {
            const gradientColor = getGradientColor(event.tickets);
            const hasUrl = !!event.url;

            // Card sizes based on row index (largest to smallest)
            const cardSizeClasses = 
              rowIndex === 1 
                ? "w-[200px] h-[200px] md:w-[240px] md:h-[240px] lg:w-[280px] lg:h-[280px]" // Row 1: largest
                : rowIndex === 2
                ? "w-[140px] h-[140px] md:w-[170px] md:h-[170px] lg:w-[200px] lg:h-[200px]" // Row 2: medium
                : "w-[110px] h-[110px] md:w-[130px] md:h-[130px] lg:w-[160px] lg:h-[160px]"; // Row 3: smallest

            return (
              <motion.div
                key={`${event.title}-${rowIndex}-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05, y: -8 }}
                className={`flex-shrink-0 ${cardSizeClasses} group cursor-pointer`}
                onClick={() => hasUrl && handleEventClick(event)}
              >
                <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 bg-white border border-[#1E1F1C]/10">
                  {/* Image or Gradient Background */}
                  {event.imageUrl ? (
                    <Image
                      src={event.imageUrl}
                      alt={event.title}
                      fill
                      className="object-cover"
                      sizes={
                        rowIndex === 1
                          ? "(max-width: 768px) 200px, (max-width: 1024px) 240px, 280px"
                          : rowIndex === 2
                          ? "(max-width: 768px) 140px, (max-width: 1024px) 170px, 200px"
                          : "(max-width: 768px) 110px, (max-width: 1024px) 130px, 160px"
                      }
                    />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradientColor}`} />
                  )}

                  {/* Content Container - Auto-sizing based on content */}
                  <div className={`absolute bottom-0 left-0 right-0 flex flex-col justify-end ${
                    rowIndex === 1 
                      ? "p-3 md:p-4 lg:p-5" 
                      : rowIndex === 2
                      ? "p-2.5 md:p-3 lg:p-4"
                      : "p-2 md:p-2.5 lg:p-3"
                  } text-white`}>
                    {/* Bottom Overlay Mask - Auto-sizing to cover content */}
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/95 via-black/85 to-black/60 pointer-events-none`} />
                    
                    {/* Title - More prominent, allow 2-3 lines based on row */}
                    <h3 className={`relative z-10 font-bold group-hover:text-[#10B8D9] transition-colors leading-tight ${
                      rowIndex === 1
                        ? "text-base md:text-lg lg:text-xl line-clamp-3" // Row 1: larger, 3 lines
                        : rowIndex === 2
                        ? "text-sm md:text-base lg:text-lg line-clamp-3" // Row 2: medium, 3 lines
                        : "text-xs md:text-sm lg:text-base line-clamp-3" // Row 3: smallest, 3 lines
                    }`}>
                      {event.title}
                    </h3>
                  </div>

                  {/* Hover Effect Overlay */}
                  <div className="absolute inset-0 bg-[#10B8D9]/0 group-hover:bg-[#10B8D9]/10 transition-colors duration-300" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
    );
  };

  return (
    <section id="events" className="bg-stone-100 py-16 md:py-24 lg:py-32 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-4 text-[#1E1F1C]">
            {t.highlights?.carouselTitle || 'All Events'}
          </h2>
          <p className="text-lg md:text-xl text-[#1E1F1C]/70 max-w-2xl mx-auto">
            {t.highlights?.carouselDescription || 'Discover exciting events happening during Taiwan Digital Fest 2026'}
          </p>
        </motion.div>
      </div>

      {/* Three Row Carousels - Full Width */}
      <div className="w-full space-y-6 md:space-y-8">
        {renderCarouselRow(x1, 1, row1Events)}
        {renderCarouselRow(x2, 2, row2Events)}
        {renderCarouselRow(x3, 3, row3Events)}
      </div>

      {/* View All Events Button - Independent Row - Prominent */}
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-16 md:mt-20 text-center"
        >
          <button
            onClick={() => {
              trackCustomEvent('ViewAllEventsClick', { location: 'events_section' });
              setIsScheduleModalOpen(true);
            }}
            className="
              group inline-flex items-center gap-3 px-10 sm:px-12 md:px-16 py-5 sm:py-6 md:py-7 rounded-xl font-bold text-xl sm:text-2xl md:text-3xl
              bg-gradient-to-r from-[#10B8D9] to-[#0EA5C9] text-white border-2 border-[#10B8D9]
              hover:from-[#10B8D9]/90 hover:to-[#0EA5C9]/90 hover:border-[#10B8D9] hover:shadow-2xl
              transition-all duration-300 shadow-xl
              transform hover:scale-110 hover:-translate-y-1
              relative overflow-hidden
            "
          >
            <span className="relative z-10">{t.highlights?.viewAllSchedule || 'View All Events'}</span>
            <svg 
              className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 relative z-10 transition-transform duration-300 group-hover:translate-x-2" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="absolute inset-0 bg-gradient-to-r from-[#10B8D9] via-[#0EA5C9] to-[#10B8D9] opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-shimmer"></span>
          </button>
        </motion.div>
      </div>

      {/* CTA Buttons */}
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 text-center flex flex-wrap justify-center gap-3 sm:gap-4"
        >
          <a
            href="https://forms.gle/EofTp9Qso27jEeeY7"
            target="_blank"
            rel="noopener noreferrer"
                    onClick={() => {
                      trackCustomEvent('CallForSideEventsClick', { location: 'events_section' });
                    }}
            className="
              group inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg
              bg-transparent text-[#10B8D9] border-2 border-[#10B8D9]
              hover:bg-[#10B8D9] hover:text-white hover:shadow-2xl
              transition-all duration-300
              transform hover:scale-105 hover:-translate-y-0.5
              relative overflow-hidden
            "
          >
            <span className="relative z-10">{t.footer.callForSideEvents}</span>
            <svg 
              className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:translate-x-1" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="absolute inset-0 bg-gradient-to-r from-[#10B8D9] to-[#0EA5C9] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
          </a>
          <a
            href="https://forms.gle/pVc6oTEi1XZ1pAR49"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackCustomEvent('CallForSpeakersClick', { location: 'events_section' });
            }}
            className="
              group inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg
              bg-transparent text-[#1E1F1C] border-2 border-[#1E1F1C]
              hover:bg-[#1E1F1C] hover:text-white hover:shadow-2xl
              transition-all duration-300
              transform hover:scale-105 hover:-translate-y-0.5
              relative overflow-hidden
            "
          >
            <span className="relative z-10">{t.footer.callForSpeakers}</span>
            <svg 
              className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:translate-x-1" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="absolute inset-0 bg-gradient-to-r from-[#1E1F1C] to-[#2D2F2C] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
          </a>
        </motion.div>
      </div>

      {/* Schedule Modal */}
      <ScheduleModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => setIsScheduleModalOpen(false)} 
      />
    </section>
  );
}
