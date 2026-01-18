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

export default function TicketTimelineSection() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [icsEvents, setIcsEvents] = useState<CalendarEvent[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  
  const saleEndDate = '2/28';
  const isOnSale = true; // 可以根据日期判断是否还在特价期间

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
        // If event has no eligibility tags, exclude it when filter is active
        if (!event.eligibility || event.eligibility.length === 0) {
          return false;
        }
        // Check if event has the matching eligibility tag
        return event.eligibility.some(tag => tag.toLowerCase() === selectedFilter);
      });
    }
    
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

  return (
    <section id="tickets-timeline" className="bg-[#1E1F1C] text-white py-24 md:py-32 overflow-hidden">
      <div className="container mx-auto px-6">
        {/* Tickets Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-display font-bold mb-4">{t.tickets.title}</h2>
          <p className="text-[#F6F6F6]/70 text-lg">{t.tickets.subtitle}</p>
        </motion.div>

        <div className="max-w-6xl mx-auto mb-24">
          {/* Sale Banner */}
          {isOnSale && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="mb-12 text-center"
            >
              <div className="inline-block bg-[#10B8D9]/20 border border-[#10B8D9]/40 rounded-xl px-6 py-4">
                <p className="text-[#10B8D9] font-bold text-xl mb-1">
                  {t.tickets.saleBanner}
                </p>
                <p className="text-[#F6F6F6]/80 text-sm">
                  {t.tickets.saleEnd} <span className="font-bold text-[#FFD028]">{saleEndDate}</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* Ticket Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {ticketTiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`
                  relative rounded-2xl p-8 border-2 transition-all duration-300
                  ${tier.color.bg} ${tier.color.border}
                  hover:shadow-2xl hover:scale-105
                `}
              >
                {/* Badge */}
                <div className={`absolute top-4 right-4 ${tier.color.badge} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                  {tier.name}
                </div>

                {/* Content */}
                <div className="mt-4">
                  <h3 className="text-2xl font-display font-bold mb-2">
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
                          <span className="text-[#F6F6F6]/60 text-sm">USD</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#F6F6F6]/40 line-through text-sm">
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
                      
                      return (
                        <div 
                          key={featureIndex} 
                          className={`flex items-start gap-2 ${isPreviousTierFeature ? 'opacity-50' : ''}`}
                        >
                          <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isPreviousTierFeature ? 'text-[#10B8D9]/50' : 'text-[#10B8D9]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className={`text-sm ${isPreviousTierFeature ? 'text-[#F6F6F6]/60' : 'text-[#F6F6F6]/80'}`}>
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

          {/* Register Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-12 text-center flex flex-wrap justify-center gap-4"
          >
            <button
              onClick={() => window.open('https://luma.com/bghtt5zv', '_blank')}
              className="
                inline-block px-8 py-4 rounded-lg font-bold text-lg
                bg-[#10B8D9] text-[#FFFFFF]
                hover:bg-[#10B8D9]/80
                transition-all duration-200 shadow-lg hover:shadow-xl
                transform hover:scale-105
              "
            >
              {t.tickets.cta}
            </button>
            <a
              href="https://forms.gle/KqJGkQhdWmSZVTdv6"
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-block px-8 py-4 rounded-lg font-bold text-lg
                bg-[#F6F6F6] text-[#1E1F1C] border-2 border-[#1E1F1C]
                hover:bg-white
                transition-all duration-200 shadow-lg hover:shadow-xl
                transform hover:scale-105
              "
            >
              {t.tickets.becomePartner}
            </a>
          </motion.div>

          {/* Note */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center text-[#F6F6F6]/60 text-sm"
          >
            <p>{t.tickets.note}</p>
          </motion.div>
        </div>

        {/* Timeline Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-display font-bold mb-4">{t.timeline.title}</h2>
          <div className="text-teal-400 font-bold tracking-widest text-xl uppercase">May 2026</div>
        </motion.div>

        <div className="max-w-8xl mx-auto">
          {/* Eligibility Filters */}
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-3 justify-center">
              <span className="text-sm text-[#F6F6F6]/70 font-medium">{t.timeline.filterLabel}</span>
              {[
                { tag: '#explorer', label: t.timeline.explorer, bg: 'bg-[#10B8D9]/20', text: 'text-[#10B8D9]', border: 'border-[#10B8D9]/40', activeBg: 'bg-[#10B8D9]/40', activeBorder: 'border-[#10B8D9]' },
                { tag: '#contributor', label: t.timeline.contributor, bg: 'bg-[#00993E]/20', text: 'text-[#00993E]', border: 'border-[#00993E]/40', activeBg: 'bg-[#00993E]/40', activeBorder: 'border-[#00993E]' },
                { tag: '#backer', label: t.timeline.backer, bg: 'bg-[#FFD028]/20', text: 'text-[#FFD028]', border: 'border-[#FFD028]/40', activeBg: 'bg-[#FFD028]/40', activeBorder: 'border-[#FFD028]' },
              ].map(({ tag, label, bg, text, border, activeBg, activeBorder }) => {
                const isSelected = selectedFilter === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    onClick={() => toggleFilter(tag.toLowerCase())}
                    className={`
                      px-4 py-2 rounded-lg border transition-all duration-200 font-medium text-sm
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
                  className="px-4 py-2 rounded-lg border border-[#1E1F1C]/50 text-[#F6F6F6]/60 hover:text-white hover:border-[#1E1F1C]/70 transition-all duration-200 font-medium text-sm"
                >
                  {t.timeline.clearFilter}
                </button>
              )}
            </div>
          </div>

          {/* Calendar Header */}
          <div className="grid grid-cols-7 mb-4 text-center text-[#F6F6F6]/60 font-medium text-sm border-b border-[#1E1F1C]/50 pb-4">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 md:gap-4">
            {calendarDays.map((day, index) => {
              // If it's an empty slot
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const events = getEventsForDay(day);
              const hasEvents = events.length > 0;
              const isSelected = selectedDate === day;

              // Determine styling based on event types
              // We'll simplisticly check if there is an "event" which is usually a range or single day.
              // We can color code or just use a generic 'active' state.

              return (
                <motion.div
                  key={day}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.01 }}
                  viewport={{ once: true }}
                  className={`relative group aspect-square md:aspect-auto md:min-h-[120px] ${
                    hasEvents ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => hasEvents && handleDateClick(day)}
                >
                  <div className={`
                            h-full w-full rounded-lg p-2 transition-all duration-300 border
                            ${hasEvents
                        ? isSelected
                        ? 'bg-[#1E1F1C] border-[#10B8D9] shadow-[0_0_20px_-3px_rgba(16,184,217,0.5)]'
                        : 'bg-[#1E1F1C] border-[#10B8D9]/50 shadow-[0_0_15px_-3px_rgba(16,184,217,0.3)] hover:border-[#10B8D9] hover:shadow-[0_0_20px_-3px_rgba(16,184,217,0.5)]'
                      : 'bg-[#1E1F1C]/30 border-[#1E1F1C]/50 hover:bg-[#1E1F1C] hover:border-[#1E1F1C]/70'}
                        `}>
                    <div className={`text-sm font-bold mb-2 ${hasEvents ? 'text-[#10B8D9]' : 'text-[#F6F6F6]/60'}`}>
                      {day}
                    </div>

                    {/* Desktop Event Indicators */}
                    <div className="hidden md:flex flex-col gap-1">
                      {events.map((event, i) => {
                        // Get unique eligibility colors for this event
                        const eligibilityColors = event.eligibility?.map(tag => {
                          const colorMap: { [key: string]: string } = {
                            '#explorer': 'bg-[#10B8D9]',
                            '#contributor': 'bg-[#00993E]',
                            '#backer': 'bg-[#FFD028]',
                          };
                          return colorMap[tag.toLowerCase()] || 'bg-[#10B8D9]';
                        }) || ['bg-[#10B8D9]'];
                        
                        return (
                          <div key={i} className="px-1.5 py-1 rounded bg-[#10B8D9]/10 text-[#10B8D9] border border-[#10B8D9]/20">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {/* Eligibility Dots */}
                              <div className="flex gap-1 items-center flex-shrink-0">
                                {eligibilityColors.map((color, colorIdx) => (
                                  <div key={colorIdx} className={`w-2 h-2 rounded-full ${color}`} title={event.eligibility?.[colorIdx] || ''} />
                                ))}
                              </div>
                              <div className="text-[10px] font-semibold leading-tight truncate flex-1">
                                {event.title}
                              </div>
                            </div>
                            {event.location && (
                              <div className="text-[9px] text-[#10B8D9]/80 leading-tight truncate flex items-center gap-1">
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

                    {/* Mobile Event Dots */}
                    <div className="md:hidden flex flex-col gap-1 mt-2">
                      {events.map((event, i) => {
                        // Get unique eligibility colors for this event
                        const eligibilityColors = event.eligibility?.map(tag => {
                          const colorMap: { [key: string]: string } = {
                            '#explorer': 'bg-[#10B8D9]',
                            '#contributor': 'bg-[#00993E]',
                            '#backer': 'bg-[#FFD028]',
                          };
                          return colorMap[tag.toLowerCase()] || 'bg-[#10B8D9]';
                        }) || ['bg-[#10B8D9]'];
                        
                        return (
                          <div key={i} className="flex gap-1 justify-center items-center">
                            {/* Eligibility dots */}
                            {eligibilityColors.map((color, colorIdx) => (
                              <div key={colorIdx} className={`w-1.5 h-1.5 rounded-full ${color}`} />
                            ))}
                            {/* If no eligibility, show default dot */}
                            {eligibilityColors.length === 0 && (
                              <div className="w-1.5 h-1.5 rounded-full bg-[#10B8D9]" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Note/Legend */}
          <div className="mt-8 text-center text-[#F6F6F6]/60 text-sm">
            {t.timeline.clickDate}
          </div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 text-center flex flex-wrap justify-center gap-4"
          >
            <a
              href="https://forms.gle/EofTp9Qso27jEeeY7"
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-block px-8 py-4 rounded-lg font-bold text-lg
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
                inline-block px-8 py-4 rounded-lg font-bold text-lg
                bg-[#F6F6F6] text-[#1E1F1C] border-2 border-[#1E1F1C]
                hover:bg-white
                transition-all duration-200 shadow-lg hover:shadow-xl
                transform hover:scale-105
              "
            >
              {t.footer.callForSpeakers}
            </a>
          </motion.div>
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={selectedDate !== null}
        onClose={handleCloseModal}
        events={getSelectedEvents()}
        date={selectedDate || 1}
      />
    </section>
  );
}
