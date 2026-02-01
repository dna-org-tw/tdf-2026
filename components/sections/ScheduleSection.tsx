'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent, trackCustomEvent } from '@/components/FacebookPixel';
import { useSectionTracking } from '@/hooks/useSectionTracking';

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
  url?: string;
  tickets?: TicketInfo;
}

export default function ScheduleSection() {
  const { t } = useTranslation();
  const [lumaEvents, setLumaEvents] = useState<CalendarEvent[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  useSectionTracking({ sectionId: 'schedule', sectionName: 'Schedule Section', category: 'Event Information' });

  // Fetch Luma calendar data
  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        const response = await fetch('/api/luma-schedule');
        if (response.ok) {
          const data = await response.json();
          setLumaEvents(data.events || []);
        }
      } catch (error) {
        console.error('Failed to fetch calendar data:', error);
      }
    };

    fetchCalendarData();
  }, []);

  // May 2026 Calendar Config
  // May 1, 2026 is a Friday.
  // 0: Mon, 1: Tue, 2: Wed, 3: Thu, 4: Fri, 5: Sat, 6: Sun
  // Friday is day 4 in a Monday-first week
  const firstDay = 4; // Friday (0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri)
  const daysInMonth = 31;

  // Generate calendar days including empty slots
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  // Group calendar days into weeks (7 days per week)
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  // Pre-process events for easier lookup by day
  // Only use Luma events (real data from Luma calendar)
  const getEventsForDay = (day: number) => {
    const dateStr = `2026-05-${day.toString().padStart(2, '0')}`;
    let filteredEvents = lumaEvents.filter(item => {
      if (!item.startDate) return false;
      return dateStr >= item.startDate && dateStr <= (item.endDate || item.startDate);
    });
    
    // Apply filter
    // Ticket tier hierarchy: follower < explorer < contributor < backer
    // Higher tier tickets can see lower tier events
    if (selectedFilter) {
      filteredEvents = filteredEvents.filter(event => {
        // If filter is "follower", show events where follower ticket is free
        if (selectedFilter === '#follower') {
          if (!event.tickets) return false;
          return event.tickets.follower?.free === true;
        }
        
        // If filter is "explorer", show events where explorer or follower ticket is free
        if (selectedFilter === '#explorer') {
          if (!event.tickets) return false;
          return event.tickets.follower?.free === true || event.tickets.explorer?.free === true;
        }
        
        // If filter is "contributor", show events where contributor, explorer, or follower ticket is free
        if (selectedFilter === '#contributor') {
          if (!event.tickets) return false;
          return event.tickets.follower?.free === true || 
                 event.tickets.explorer?.free === true || 
                 event.tickets.contributor?.free === true;
        }
        
        // If filter is "backer", show events where any ticket is free
        if (selectedFilter === '#backer') {
          if (!event.tickets) return false;
          return event.tickets.follower?.free === true || 
                 event.tickets.explorer?.free === true || 
                 event.tickets.contributor?.free === true || 
                 event.tickets.backer?.free === true;
        }
        
        // If filter is "other", show events with no eligibility tags
        if (selectedFilter === '#other') {
          return !event.eligibility || event.eligibility.length === 0;
        }
        
        // If event has no eligibility tags, exclude it when filter is active (and not "other")
        if (!event.eligibility || event.eligibility.length === 0) {
          return false;
        }
        // Check if event has the matching eligibility tag
        return event.eligibility.some(tag => tag.toLowerCase() === selectedFilter);
      });
    }
    
    // Sort events: all-day events (without startTime) first, then events with startTime sorted by time
    filteredEvents.sort((a, b) => {
      // If both have startTime, compare them by time
      if (a.startTime && b.startTime) {
        const timeA = new Date(a.startTime).getTime();
        const timeB = new Date(b.startTime).getTime();
        return timeA - timeB;
      }
      // If only a has startTime, b (all-day) comes first
      if (a.startTime && !b.startTime) return 1;
      // If only b has startTime, a (all-day) comes first
      if (!a.startTime && b.startTime) return -1;
      // If neither has startTime, maintain original order
      return 0;
    });
    
    return filteredEvents;
  };
  
  const toggleFilter = (filter: string) => {
    // Track filter usage
    if (selectedFilter !== filter) {
      trackEvent('Search', {
        search_string: filter,
        content_category: 'Schedule Filter'
      });
      trackCustomEvent('ScheduleFilter', {
        filter_type: filter
      });
    }
    // If clicking the same filter, deselect it
    if (selectedFilter === filter) {
      setSelectedFilter(null);
    } else {
      setSelectedFilter(filter);
    }
  };
  
  const clearFilter = () => {
    setSelectedFilter(null);
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.url) {
      trackEvent('Lead', {
        content_name: 'Luma Event Link',
        content_category: 'Event Schedule',
      });
      trackCustomEvent('EventClick', {
        event_title: event.title,
        event_url: event.url,
        location: 'schedule_calendar',
      });
      window.open(event.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Format time to 12-hour format (HHam/HHpm)
  const formatTime = (isoString: string | null | undefined): string | null => {
    if (!isoString) return null;
    
    try {
      const date = new Date(isoString);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      
      // Convert to 12-hour format
      const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const ampm = hours < 12 ? 'am' : 'pm';
      
      // Format as HHam or HHpm (no minutes if 0)
      if (minutes === 0) {
        return `${hour12}${ampm}`;
      } else {
        // Include minutes if not 0
        const minutesStr = String(minutes).padStart(2, '0');
        return `${hour12}:${minutesStr}${ampm}`;
      }
    } catch (error) {
      console.error('Error formatting time:', error);
      return null;
    }
  };

  // Get the lowest tier color for an event based on ticket pricing
  // Priority: follower < explorer < contributor < backer
  const getLowestTierColor = (tickets?: TicketInfo) => {
    if (!tickets) {
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-300',
      };
    }

    // Check in priority order: follower < explorer < contributor < backer
    if (tickets.follower?.free) {
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        border: 'border-purple-300',
      };
    }
    if (tickets.explorer?.free) {
      return {
        bg: 'bg-[#10B8D9]/10',
        text: 'text-[#10B8D9]',
        border: 'border-[#10B8D9]/30',
      };
    }
    if (tickets.contributor?.free) {
      return {
        bg: 'bg-[#00993E]/10',
        text: 'text-[#00993E]',
        border: 'border-[#00993E]/30',
      };
    }
    if (tickets.backer?.free) {
      return {
        bg: 'bg-[#FFD028]/10',
        text: 'text-[#FFD028]',
        border: 'border-[#FFD028]/30',
      };
    }

    // Default to other color (gray) if no tickets are free
    return {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      border: 'border-gray-300',
    };
  };

  return (
    <>
      {/* Schedule Section */}
      <section id="schedule" className="bg-gray-50 text-[#1E1F1C] py-20 md:py-28 lg:py-32 transition-colors duration-500">
        <div className="container mx-auto px-4 sm:px-6">
          {/* Timeline Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 md:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 text-[#1E1F1C]">{t.schedule.title}</h2>
            <div className="text-[#10B8D9] font-bold tracking-widest text-xl uppercase">May 2026</div>
          </motion.div>

          <div className="max-w-8xl mx-auto">
            {/* Eligibility Filters */}
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-center">
                <span className="text-sm text-[#1E1F1C]/70 font-medium">{t.schedule.filterLabel}</span>
                {[
                  { tag: '#follower', label: t.schedule.follower, bg: 'bg-purple-200', text: 'text-purple-700', border: 'border-purple-400', activeBg: 'bg-purple-300', activeBorder: 'border-purple-500' },
                  { tag: '#explorer', label: t.schedule.explorer, bg: 'bg-[#10B8D9]/20', text: 'text-[#10B8D9]', border: 'border-[#10B8D9]/40', activeBg: 'bg-[#10B8D9]/40', activeBorder: 'border-[#10B8D9]' },
                  { tag: '#contributor', label: t.schedule.contributor, bg: 'bg-[#00993E]/20', text: 'text-[#00993E]', border: 'border-[#00993E]/40', activeBg: 'bg-[#00993E]/40', activeBorder: 'border-[#00993E]' },
                  { tag: '#backer', label: t.schedule.backer, bg: 'bg-[#FFD028]/20', text: 'text-[#FFD028]', border: 'border-[#FFD028]/40', activeBg: 'bg-[#FFD028]/40', activeBorder: 'border-[#FFD028]' },
                  { tag: '#other', label: t.schedule.other, bg: 'bg-gray-200', text: 'text-gray-700', border: 'border-gray-300', activeBg: 'bg-gray-300', activeBorder: 'border-gray-500' },
                ].map(({ tag, label, bg, text, border, activeBg, activeBorder }) => {
                  const isSelected = selectedFilter === tag.toLowerCase();
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleFilter(tag.toLowerCase())}
                      className={`
                        px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border transition-all duration-200 font-medium text-xs sm:text-sm
                        ${isSelected 
                          ? `${activeBg} ${text} ${activeBorder} shadow-lg` 
                          : `${bg} ${text} ${border} hover:opacity-80`}
                      `}
                    >
                      {label}
                    </button>
                  );
                })}
                {selectedFilter && (
                  <button
                    onClick={clearFilter}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-[#1E1F1C]/30 text-[#1E1F1C]/60 hover:text-[#1E1F1C] hover:border-[#1E1F1C]/50 transition-all duration-200 font-medium text-xs sm:text-sm"
                  >
                    {t.schedule.clearFilter}
                  </button>
                )}
              </div>
            </div>

            {/* Calendar Header */}
            <div className="grid grid-cols-7 mb-4 text-center text-[#1E1F1C]/60 font-medium text-sm border-b border-[#1E1F1C]/20 pb-4">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="space-y-3 sm:space-y-4 md:space-y-5">
              {weeks.map((week, weekIndex) => {
                const globalIndexOffset = weekIndex * 7;
                return (
                  <div key={weekIndex}>
                    {/* Week Separator (except for first week) */}
                    {weekIndex > 0 && (
                      <div className="border-t border-[#1E1F1C]/10 mb-2 sm:mb-3 md:mb-4" />
                    )}
                    
                    {/* Week Grid */}
                    <div className="grid grid-cols-7 gap-2 sm:gap-3 md:gap-4">
                      {week.map((day, dayIndex) => {
                        const globalIndex = globalIndexOffset + dayIndex;
                        
                        // If it's an empty slot
                        if (day === null) {
                          return <div key={`empty-${globalIndex}`} className="min-h-[60px] md:min-h-[80px]" />;
                        }

                        const events = getEventsForDay(day);

                        return (
                          <motion.div
                            key={day}
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ delay: globalIndex * 0.01 }}
                            viewport={{ once: true }}
                            className="relative group min-h-[60px] md:min-h-[80px]"
                          >
                            <div className="w-full rounded-lg p-2 transition-all duration-300 border bg-white border-[#1E1F1C]/20 shadow-sm hover:bg-stone-50 hover:border-[#1E1F1C]/30">
                              <div className="text-sm font-bold mb-2 text-[#1E1F1C]/60">
                                {day}
                              </div>

                              {/* Desktop Event Indicators */}
                              <div className="hidden md:flex flex-col gap-1">
                                {events.map((event, i) => {
                                  const tierColors = getLowestTierColor(event.tickets);
                                  const timeStr = formatTime(event.startTime);
                                  const hasUrl = !!event.url;
                                  
                                  return (
                                    <div
                                      key={i}
                                      onClick={() => hasUrl && handleEventClick(event)}
                                      className={`
                                        px-1.5 py-1 rounded ${tierColors.bg} ${tierColors.text} border ${tierColors.border}
                                        ${hasUrl ? 'cursor-pointer hover:opacity-80 hover:shadow-md transition-all duration-200' : ''}
                                      `}
                                    >
                                      <div className="text-sm font-semibold leading-tight mb-0.5 text-[#1E1F1C] break-words">
                                        {timeStr && <span className="font-medium text-[#1E1F1C]/70 mr-1.5">{timeStr}</span>}
                                        {event.title}
                                      </div>
                                      {event.location && (
                                        <div className="text-[9px] text-[#1E1F1C]/70 leading-tight truncate flex items-center gap-1">
                                          <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                          </svg>
                                          <span className="truncate">{event.location}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Mobile Event Indicators */}
                              <div className="md:hidden flex flex-col gap-1 mt-2">
                                {events.map((event, i) => {
                                  const tierColors = getLowestTierColor(event.tickets);
                                  const hasUrl = !!event.url;
                                  
                                  return (
                                    <div
                                      key={i}
                                      onClick={() => hasUrl && handleEventClick(event)}
                                      className={`
                                        w-full h-1.5 rounded ${tierColors.bg} ${tierColors.border} border
                                        ${hasUrl ? 'cursor-pointer hover:opacity-80 transition-opacity duration-200' : ''}
                                      `}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Note/Legend */}
            <div className="mt-8 text-center text-[#1E1F1C]/60 text-sm">
              {t.schedule.clickEvent}
            </div>

            {/* CTA Buttons */}
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
                  trackCustomEvent('CallForSideEventsClick', { location: 'schedule_section' });
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
                  trackCustomEvent('CallForSpeakersClick', { location: 'schedule_section' });
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
        </div>
      </section>
    </>
  );
}
