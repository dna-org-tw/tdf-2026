'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import EventModal from '@/components/EventModal';

interface TicketTier {
  name: string;
  key: 'explore' | 'contribute' | 'backer';
  originalPrice: number;
  salePrice: number;
  color: {
    bg: string;
    text: string;
    border: string;
    badge: string;
  };
}

interface CalendarEvent {
  title: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string | null;
  startTime?: string | null;
  eligibility?: string[];
}

const ticketTiers: TicketTier[] = [
  {
    name: 'Explorer',
    key: 'explore',
    originalPrice: 30,
    salePrice: 20,
    color: {
      bg: 'bg-[#10B8D9]/10',
      text: 'text-[#10B8D9]',
      border: 'border-[#10B8D9]/40',
      badge: 'bg-[#10B8D9]',
    },
  },
  {
    name: 'Contributor',
    key: 'contribute',
    originalPrice: 300,
    salePrice: 200,
    color: {
      bg: 'bg-[#00993E]/10',
      text: 'text-[#00993E]',
      border: 'border-[#00993E]/40',
      badge: 'bg-[#00993E]',
    },
  },
  {
    name: 'Backer',
    key: 'backer',
    originalPrice: 600,
    salePrice: 400,
    color: {
      bg: 'bg-[#FFD028]/10',
      text: 'text-[#FFD028]',
      border: 'border-[#FFD028]/40',
      badge: 'bg-[#FFD028]',
    },
  },
];

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export default function TicketTimelineSection() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [icsEvents, setIcsEvents] = useState<CalendarEvent[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<CountdownTime | null>(null);
  
  const saleEndDate = '2/28';
  
  // Calculate countdown to February 28, 2026 (end of day UTC)
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      // February 28, 2026 23:59:59 UTC
      const endDate = new Date('2026-02-28T23:59:59Z');
      const difference = endDate.getTime() - now.getTime();
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setCountdown({
          days,
          hours,
          minutes,
          seconds,
          total: difference
        });
      } else {
        setCountdown({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          total: 0
        });
      }
    };
    
    // Calculate immediately
    calculateCountdown();
    
    // Update every second
    const interval = setInterval(calculateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const isOnSale = countdown !== null && countdown.total > 0;

  // Fetch ICS calendar data
  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        const response = await fetch('/api/calendar');
        if (response.ok) {
          const data = await response.json();
          setIcsEvents(data.events || []);
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
  // Only use ICS events (real data from Google Calendar)
  const getEventsForDay = (day: number) => {
    const dateStr = `2026-05-${day.toString().padStart(2, '0')}`;
    let filteredEvents = icsEvents.filter(item => {
      if (!item.startDate) return false;
      return dateStr >= item.startDate && dateStr <= (item.endDate || item.startDate);
    });
    
    // Apply eligibility filter
    if (selectedFilter) {
      filteredEvents = filteredEvents.filter(event => {
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

  const handleDateClick = (day: number) => {
    const events = getEventsForDay(day);
    if (events.length > 0) {
      setSelectedDate(day);
    }
  };

  const handleCloseModal = () => {
    setSelectedDate(null);
  };

  const getSelectedEvents = () => {
    if (selectedDate === null) return [];
    return getEventsForDay(selectedDate);
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

  // Get the lowest tier color for an event based on eligibility
  const getLowestTierColor = (eligibility?: string[]) => {
    if (!eligibility || eligibility.length === 0) {
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-300',
      };
    }

    // Priority: explorer < contributor < backer
    const hasExplorer = eligibility.some(tag => tag.toLowerCase() === '#explorer');
    const hasContributor = eligibility.some(tag => tag.toLowerCase() === '#contributor');
    const hasBacker = eligibility.some(tag => tag.toLowerCase() === '#backer');

    if (hasExplorer) {
      return {
        bg: 'bg-[#10B8D9]/10',
        text: 'text-[#10B8D9]',
        border: 'border-[#10B8D9]/30',
      };
    }
    if (hasContributor) {
      return {
        bg: 'bg-[#00993E]/10',
        text: 'text-[#00993E]',
        border: 'border-[#00993E]/30',
      };
    }
    if (hasBacker) {
      return {
        bg: 'bg-[#FFD028]/10',
        text: 'text-[#FFD028]',
        border: 'border-[#FFD028]/30',
      };
    }

    // Default to other color (gray) if no matching tags
    return {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      border: 'border-gray-300',
    };
  };

  return (
    <>
      {/* Tickets Section */}
      <section id="tickets-timeline" className="bg-gradient-to-r from-[#1E1F1C] via-[#1E1F1C] to-[#1E1F1C] text-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Sale Banner Info - Only show if on sale */}
          {isOnSale && countdown && countdown.total > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center mb-12 md:mb-16 space-y-4"
            >
              <motion.p
                className="text-[#10B8D9] font-bold text-xl sm:text-2xl md:text-3xl"
                animate={{
                  textShadow: [
                    "0 0 10px rgba(16, 184, 217, 0.3)",
                    "0 0 25px rgba(16, 184, 217, 0.6)",
                    "0 0 10px rgba(16, 184, 217, 0.3)"
                  ]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {t.tickets.saleBanner}
              </motion.p>
              
              {/* Countdown Info */}
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-white/80 text-sm sm:text-base">
                    {t.tickets.saleEnd}
                  </span>
                  <span className="font-bold text-[#FFD028] text-xl sm:text-2xl md:text-3xl tracking-wide">
                    {saleEndDate}
                  </span>
                </div>
                
                <motion.div
                  className="flex items-baseline gap-2"
                  key={`days-${countdown.days}`}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.span
                    className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#10B8D9] tabular-nums"
                    key={countdown.days}
                    animate={{ 
                      textShadow: countdown.total < 86400000
                        ? [
                            "0 0 20px rgba(16, 184, 217, 0.5)",
                            "0 0 40px rgba(16, 184, 217, 0.8)",
                            "0 0 20px rgba(16, 184, 217, 0.5)"
                          ]
                        : [
                            "0 0 10px rgba(16, 184, 217, 0.3)",
                            "0 0 25px rgba(16, 184, 217, 0.6)",
                            "0 0 10px rgba(16, 184, 217, 0.3)"
                          ]
                    }}
                    transition={{ 
                      duration: 0.2,
                      textShadow: {
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }
                    }}
                  >
                    {countdown.days}
                  </motion.span>
                  <span className="text-base sm:text-lg md:text-xl text-[#10B8D9] font-semibold uppercase tracking-wide">
                    {countdown.days === 1 ? 'Day' : 'Days'} Left
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Ticket Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-12 md:mb-16">
            {ticketTiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`
                  relative rounded-2xl p-8 border-2 transition-all duration-300
                  bg-gradient-to-br from-[#1E1F1C] to-[#1E1F1C]/90 backdrop-blur-sm ${tier.color.border}
                  hover:shadow-2xl hover:shadow-[#10B8D9]/20 hover:scale-105 hover:from-[#1E1F1C]/95 hover:to-[#1E1F1C]/85
                `}
              >
                {/* Badge */}
                <div className={`absolute top-4 right-4 ${tier.color.badge} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                  {tier.name}
                </div>

                {/* Content */}
                <div className="mt-4">
                  <h3 className="text-2xl font-display font-bold mb-2 text-white">
                    {t.tickets[tier.key].label}
                  </h3>
                  
                  {/* Pricing */}
                  <div className="mb-6">
                    {isOnSale ? (
                      <div>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-3xl font-bold text-white">
                            ${tier.salePrice}
                          </span>
                          <span className="text-white/70 text-sm">USD</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/50 line-through text-sm">
                            ${tier.originalPrice} USD
                          </span>
                          <span className="text-[#FFD028] text-xs font-medium">
                            {t.tickets.save} ${tier.originalPrice - tier.salePrice}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">
                          ${tier.originalPrice}
                        </span>
                        <span className="text-[#F6F6F6]/60 text-sm">USD</span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-3">
                    {t.tickets[tier.key].features.map((feature, featureIndex) => {
                      // Extract core feature name (remove quantity suffix like " x 1", " x 10+", etc.)
                      const getCoreFeatureName = (f: string) => {
                        // Remove patterns like " x 1", " x 10+", " x 4", etc.
                        return f.replace(/\s*x\s*\d+\+?$/, '').trim();
                      };
                      
                      const currentCore = getCoreFeatureName(feature);
                      
                      // Check if this is Digital Nomad Activities (should not be dimmed)
                      const isDigitalNomadActivities = 
                        currentCore.includes('Digital Nomad Activities') || 
                        currentCore.includes('數位遊牧活動');
                      
                      // Check if this feature exists in previous tier (but exclude Digital Nomad Activities)
                      let isPreviousTierFeature = false;
                      if (!isDigitalNomadActivities) {
                        if (tier.key === 'contribute') {
                          // Check if feature exists in explore
                          isPreviousTierFeature = t.tickets.explore.features.some(prevFeature => {
                            const prevCore = getCoreFeatureName(prevFeature);
                            return currentCore === prevCore;
                          });
                        } else if (tier.key === 'backer') {
                          // Check if feature exists in contribute
                          isPreviousTierFeature = t.tickets.contribute.features.some(prevFeature => {
                            const prevCore = getCoreFeatureName(prevFeature);
                            return currentCore === prevCore;
                          });
                        }
                      }
                      
                      // Check if this is a unique feature (not in previous tier)
                      const isUniqueFeature = !isPreviousTierFeature;
                      
                      // Get tier-specific color for unique features
                      const getTierColor = () => {
                        if (!isUniqueFeature) return { icon: 'text-white/70', text: 'text-white/90' };
                        switch (tier.key) {
                          case 'contribute':
                            return { icon: 'text-[#00993E]', text: 'text-[#00993E] font-semibold' };
                          case 'backer':
                            return { icon: 'text-[#FFD028]', text: 'text-[#FFD028] font-semibold' };
                          default:
                            return { icon: 'text-[#10B8D9]', text: 'text-[#10B8D9] font-semibold' };
                        }
                      };
                      
                      const colors = getTierColor();
                      
                      return (
                        <div 
                          key={featureIndex} 
                          className="flex items-start gap-2"
                        >
                          <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className={`text-sm ${colors.text}`}>
                            {feature}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Register and Partner Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-center space-y-4"
          >
            {/* Register Button - Full Width */}
            <div className="w-full max-w-2xl mx-auto">
              <button
                onClick={() => window.open('https://luma.com/bghtt5zv', '_blank')}
                className="
                  w-full px-6 sm:px-8 py-4 sm:py-5 rounded-lg font-bold text-base sm:text-lg md:text-xl
                  bg-[#10B8D9] text-[#FFFFFF]
                  hover:bg-[#10B8D9]/80
                  transition-all duration-200 shadow-lg hover:shadow-xl
                  transform hover:scale-[1.02]
                "
              >
                {t.tickets.cta}
              </button>
            </div>

            {/* Partner Button - Next Line */}
            <div className="w-full max-w-2xl mx-auto">
              <a
                href="https://forms.gle/KqJGkQhdWmSZVTdv6"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  inline-block w-full px-6 sm:px-8 py-4 sm:py-5 rounded-lg font-bold text-base sm:text-lg md:text-xl text-center
                  bg-white/10 text-white border-2 border-white/30
                  hover:bg-white/20 hover:border-white/50
                  transition-all duration-200 shadow-lg hover:shadow-xl
                  transform hover:scale-[1.02]
                "
              >
                {t.tickets.becomePartner}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Schedule Section */}
      <section className="bg-gray-50 text-[#1E1F1C] py-24 md:py-32">
        <div className="container mx-auto px-4 sm:px-6">
          {/* Timeline Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4 text-[#1E1F1C]">{t.timeline.title}</h2>
            <div className="text-[#10B8D9] font-bold tracking-widest text-xl uppercase">May 2026</div>
          </motion.div>

          <div className="max-w-8xl mx-auto">
            {/* Eligibility Filters */}
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-center">
                <span className="text-sm text-[#1E1F1C]/70 font-medium">{t.timeline.filterLabel}</span>
                {[
                  { tag: '#explorer', label: t.timeline.explorer, bg: 'bg-[#10B8D9]/20', text: 'text-[#10B8D9]', border: 'border-[#10B8D9]/40', activeBg: 'bg-[#10B8D9]/40', activeBorder: 'border-[#10B8D9]' },
                  { tag: '#contributor', label: t.timeline.contributor, bg: 'bg-[#00993E]/20', text: 'text-[#00993E]', border: 'border-[#00993E]/40', activeBg: 'bg-[#00993E]/40', activeBorder: 'border-[#00993E]' },
                  { tag: '#backer', label: t.timeline.backer, bg: 'bg-[#FFD028]/20', text: 'text-[#FFD028]', border: 'border-[#FFD028]/40', activeBg: 'bg-[#FFD028]/40', activeBorder: 'border-[#FFD028]' },
                  { tag: '#other', label: t.timeline.other, bg: 'bg-gray-200', text: 'text-gray-700', border: 'border-gray-300', activeBg: 'bg-gray-300', activeBorder: 'border-gray-500' },
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
                    {t.timeline.clearFilter}
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
            <div className="space-y-2 sm:space-y-3 md:space-y-4">
              {weeks.map((week, weekIndex) => {
                const globalIndexOffset = weekIndex * 7;
                return (
                  <div key={weekIndex}>
                    {/* Week Separator (except for first week) */}
                    {weekIndex > 0 && (
                      <div className="border-t border-[#1E1F1C]/10 mb-2 sm:mb-3 md:mb-4" />
                    )}
                    
                    {/* Week Grid */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 md:gap-4">
                      {week.map((day, dayIndex) => {
                        const globalIndex = globalIndexOffset + dayIndex;
                        
                        // If it's an empty slot
                        if (day === null) {
                          return <div key={`empty-${globalIndex}`} className="min-h-[60px] md:min-h-[80px]" />;
                        }

                        const events = getEventsForDay(day);
                        const hasEvents = events.length > 0;
                        const isSelected = selectedDate === day;

                        return (
                          <motion.div
                            key={day}
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ delay: globalIndex * 0.01 }}
                            viewport={{ once: true }}
                            className={`relative group min-h-[60px] md:min-h-[80px] ${
                              hasEvents ? 'cursor-pointer' : ''
                            }`}
                            onClick={() => hasEvents && handleDateClick(day)}
                          >
                            <div className={`
                              w-full rounded-lg p-2 transition-all duration-300 border
                              ${hasEvents
                                ? isSelected
                                  ? 'bg-[#10B8D9]/10 border-[#1E1F1C]/20 shadow-[0_0_20px_-3px_rgba(16,184,217,0.5)]'
                                  : 'bg-white border-[#1E1F1C]/20 shadow-sm hover:bg-stone-100 hover:border-[#1E1F1C]/30'
                                : 'bg-stone-50 border-[#1E1F1C]/20 hover:bg-stone-100 hover:border-[#1E1F1C]/30'}
                            `}>
                              <div className="text-sm font-bold mb-2 text-[#1E1F1C]/60">
                                {day}
                              </div>

                              {/* Desktop Event Indicators */}
                              <div className="hidden md:flex flex-col gap-1">
                                {events.map((event, i) => {
                                  const tierColors = getLowestTierColor(event.eligibility);
                                  const timeStr = formatTime(event.startTime);
                                  
                                  return (
                                    <div key={i} className={`px-1.5 py-1 rounded ${tierColors.bg} ${tierColors.text} border ${tierColors.border}`}>
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
                                  const tierColors = getLowestTierColor(event.eligibility);
                                  
                                  return (
                                    <div key={i} className={`w-full h-1.5 rounded ${tierColors.bg} ${tierColors.border} border`} />
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
              {t.timeline.clickDate}
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
                className="
                  inline-block px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg
                  bg-[#10B8D9] text-[#FFFFFF]
                  hover:bg-[#10B8D9]/80
                  transition-all duration-200 shadow-lg hover:shadow-xl
                  transform hover:scale-105
                "
              >
                {t.footer.callForSideEvents}
              </a>
              <a
                href="https://forms.gle/pVc6oTEi1XZ1pAR49"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  inline-block px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg
                  bg-[#1E1F1C] text-white border-2 border-[#1E1F1C]
                  hover:bg-[#1E1F1C]/90
                  transition-all duration-200 shadow-lg hover:shadow-xl
                  transform hover:scale-105
                "
              >
                {t.footer.callForSpeakers}
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Event Modal */}
      <EventModal
        isOpen={selectedDate !== null}
        onClose={handleCloseModal}
        events={getSelectedEvents()}
        date={selectedDate || 1}
      />
    </>
  );
}
