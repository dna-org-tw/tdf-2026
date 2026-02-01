'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent, trackCustomEvent } from '@/components/FacebookPixel';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import { Calendar, MapPin } from 'lucide-react';

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

export default function HighlightsSection() {
  const { t } = useTranslation();
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  
  // 两行轮播，每行独立的 motion value 和 animation ref
  const x1 = useMotionValue(0);
  const x2 = useMotionValue(0);
  const animationRef1 = useRef<number | null>(null);
  const animationRef2 = useRef<number | null>(null);
  const initializedRef2 = useRef(false);
  
  useSectionTracking({ sectionId: 'highlights', sectionName: 'Highlights Section', category: 'Event Information' });

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
    const tagNames = event.tags?.map(tag => tag.name.toLowerCase()) || 
                    event.eligibility?.map(tag => tag.toLowerCase().replace('#', '')) || [];
    
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

  // Categorize events by their lowest ticket tier
  const row1Events: CalendarEvent[] = []; // #backer and #contributor
  const row2Events: CalendarEvent[] = []; // Others (lowest tier = explorer, follower, or null)
  
  allEvents.forEach((event) => {
    const lowestTier = getLowestTicketTier(event);
    
    if (lowestTier === 'backer' || lowestTier === 'contributor') {
      row1Events.push(event);
    } else {
      // explorer, follower, or no tier tag -> row 2
      row2Events.push(event);
    }
  });

  // Calculate carousel dimensions based on row index
  // Row 1 (largest): sm: 260px, md: 320px, lg: 360px
  // Row 2 (medium): sm: 180px, md: 220px, lg: 260px
  const getEventWidth = (rowIndex: number) => {
    if (typeof window === 'undefined') {
      // Default values for SSR
      if (rowIndex === 1) return 260 + 20;
      return 180 + 20;
    }
    
    if (window.innerWidth >= 1024) {
      // lg breakpoint
      if (rowIndex === 1) return 360 + 24; // Row 1: largest
      return 260 + 24; // Row 2: medium
    }
    if (window.innerWidth >= 768) {
      // md breakpoint
      if (rowIndex === 1) return 320 + 24;
      return 220 + 24;
    }
    // sm breakpoint
    if (rowIndex === 1) return 260 + 20;
    return 180 + 20;
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

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [row1Events.length, row2Events.length, x1, x2]);

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

  // Auto-scroll animation for row 2 (30s, offset start)
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
      const duration = 30; // 30 seconds for one cycle
      
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


  // Format date to readable format
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      return `${month} ${day}`;
    } catch (error) {
      return dateStr;
    }
  };

  // Format time to 12-hour format
  const formatTime = (isoString: string | null | undefined): string | null => {
    if (!isoString) return null;
    
    try {
      const date = new Date(isoString);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      
      const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const ampm = hours < 12 ? 'am' : 'pm';
      
      if (minutes === 0) {
        return `${hour12}${ampm}`;
      } else {
        const minutesStr = String(minutes).padStart(2, '0');
        return `${hour12}:${minutesStr}${ampm}`;
      }
    } catch (error) {
      return null;
    }
  };

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
        location: 'highlights_section',
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
            const dateStr = formatDate(event.startDate);
            const timeStr = formatTime(event.startTime);
            const hasUrl = !!event.url;

            // Card sizes based on row index
            const cardSizeClasses = 
              rowIndex === 1 
                ? "w-[260px] h-[260px] md:w-[320px] md:h-[320px] lg:w-[360px] lg:h-[360px]" // Row 1: largest
                : "w-[180px] h-[180px] md:w-[220px] md:h-[220px] lg:w-[260px] lg:h-[260px]"; // Row 2: medium

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
                          ? "(max-width: 768px) 260px, (max-width: 1024px) 320px, 360px"
                          : "(max-width: 768px) 180px, (max-width: 1024px) 220px, 260px"
                      }
                    />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradientColor}`} />
                  )}

                  {/* Bottom Overlay Mask - Increased height for better visibility */}
                  <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/85 to-black/60 ${
                    rowIndex === 1 
                      ? "h-[50%]" // Row 1: 50% height
                      : "h-[55%]" // Row 2: 55% height
                  }`} />

                  {/* Content on Mask */}
                  <div className={`absolute bottom-0 left-0 right-0 flex flex-col justify-end ${
                    rowIndex === 1 
                      ? "h-[50%] p-3 md:p-4 lg:p-5" 
                      : "h-[55%] p-2.5 md:p-3 lg:p-4"
                  } text-white`}>
                    {/* Title - More prominent, allow 2-3 lines based on row */}
                    <h3 className={`font-bold group-hover:text-[#10B8D9] transition-colors leading-tight ${
                      rowIndex === 1
                        ? "text-base md:text-lg lg:text-xl line-clamp-2 mb-2.5 md:mb-3" // Row 1: larger, 2 lines
                        : "text-sm md:text-base lg:text-lg line-clamp-2 mb-2 md:mb-2.5" // Row 2: medium, 2 lines
                    }`}>
                      {event.title}
                    </h3>

                    {/* Date & Time - More prominent display */}
                    <div className="flex flex-col gap-1 mb-2">
                      <div className={`flex items-center gap-1.5 flex-wrap ${
                        rowIndex === 1
                          ? "text-xs md:text-sm gap-1.5"
                          : "text-[10px] md:text-xs gap-1"
                      } font-semibold`}>
                        <div className={`flex items-center gap-1 bg-white/25 backdrop-blur-md rounded-lg border border-white/20 ${
                          rowIndex === 1 
                            ? "px-2 py-1 gap-1"
                            : "px-1.5 py-0.5 gap-1"
                        }`}>
                          <Calendar className={`${
                            rowIndex === 1 ? "w-3 h-3 md:w-3.5 md:h-3.5" : "w-2.5 h-2.5 md:w-3 md:h-3"
                          }`} />
                          <span>{dateStr}</span>
                        </div>
                        {timeStr && (
                          <div className={`flex items-center gap-1 bg-white/25 backdrop-blur-md rounded-lg border border-white/20 ${
                            rowIndex === 1 
                              ? "px-2 py-1"
                              : "px-1.5 py-0.5"
                          }`}>
                            <span className="font-medium">{timeStr}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location */}
                    <div className={`flex items-center gap-1 text-white/90 ${
                      rowIndex === 1
                        ? "text-[10px] md:text-xs"
                        : "text-[9px] md:text-[10px]"
                    }`}>
                      <MapPin className={`${
                        rowIndex === 1 ? "w-3 h-3 md:w-3.5 md:h-3.5" : "w-2.5 h-2.5 md:w-3 md:h-3"
                      } flex-shrink-0`} />
                      <span className="line-clamp-1">{event.location || 'TBD'}</span>
                    </div>
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
    <section id="highlights" className="bg-stone-100 py-16 md:py-24 lg:py-32 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-4 text-[#1E1F1C]">
            {t.highlights?.carouselTitle || 'Featured Events'}
          </h2>
          <p className="text-lg md:text-xl text-[#1E1F1C]/70 max-w-2xl mx-auto">
            {t.highlights?.carouselDescription || 'Discover exciting events happening during Taiwan Digital Fest 2026'}
          </p>
        </motion.div>
      </div>

      {/* Two Row Carousels - Full Width */}
      <div className="w-full space-y-6 md:space-y-8">
        {renderCarouselRow(x1, 1, row1Events)}
        {renderCarouselRow(x2, 2, row2Events)}
      </div>

      {/* CTA Buttons */}
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center flex flex-wrap justify-center gap-3 sm:gap-4"
        >
          <a
            href="https://forms.gle/EofTp9Qso27jEeeY7"
            target="_blank"
            rel="noopener noreferrer"
                    onClick={() => {
                      trackCustomEvent('CallForSideEventsClick', { location: 'highlights_section' });
                    }}
            className="
              group inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg
              bg-[#10B8D9] text-[#FFFFFF]
              hover:bg-[#10B8D9]/90 hover:shadow-2xl
              transition-all duration-300 shadow-lg
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
              trackCustomEvent('CallForSpeakersClick', { location: 'highlights_section' });
            }}
            className="
              group inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg
              bg-[#1E1F1C] text-white border-2 border-[#1E1F1C]
              hover:bg-[#1E1F1C]/95 hover:border-[#10B8D9] hover:shadow-2xl
              transition-all duration-300 shadow-lg
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
    </section>
  );
}
