'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { ExternalLink } from 'lucide-react';

interface LumaEvent {
  title: string;
  url: string;
  date?: string;
  location?: string;
  description?: string;
  imageUrl?: string;
}

export default function SideEventCalendarSection() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<LumaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLumaEvents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/luma-events');
        if (response.ok) {
          const data = await response.json();
          setEvents(data.events || []);
        } else {
          setError('Failed to load events');
        }
      } catch (err) {
        console.error('Failed to fetch Luma events:', err);
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchLumaEvents();
  }, []);

  return (
    <section id="side-events" className="bg-white text-[#1E1F1C] py-24 md:py-32">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-display font-bold mb-4 text-[#1E1F1C]">
            {t.sideEvents?.title || 'Side Events Calendar'}
          </h2>
          <p className="text-lg text-[#1E1F1C]/70 max-w-2xl mx-auto">
            {t.sideEvents?.subtitle || 'Discover community-organized side events happening throughout May 2026'}
          </p>
        </motion.div>

        {/* Events Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#10B8D9]"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-[#1E1F1C]/60">
            <p>{error}</p>
            <p className="mt-2 text-sm">
              {t.sideEvents?.errorMessage || 'Please try again later or visit the Luma calendar directly.'}
            </p>
            <a
              href="https://luma.com/taiwan-digital-nomad-hub?k=c"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block px-6 py-3 rounded-lg bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-colors"
            >
              {t.sideEvents?.visitLuma || 'Visit Luma Calendar'}
            </a>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 text-[#1E1F1C]/60">
            <p>{t.sideEvents?.noEvents || 'No side events found at the moment.'}</p>
            <a
              href="https://luma.com/taiwan-digital-nomad-hub?k=c"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block px-6 py-3 rounded-lg bg-[#10B8D9] text-white hover:bg-[#10B8D9]/80 transition-colors"
            >
              {t.sideEvents?.visitLuma || 'Visit Luma Calendar'}
            </a>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event, index) => (
                <motion.a
                  key={event.url || index}
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="
                    group block p-6 rounded-lg border border-[#1E1F1C]/20
                    bg-white hover:bg-stone-50
                    transition-all duration-300
                    hover:shadow-lg hover:border-[#10B8D9]/40
                    transform hover:scale-[1.02]
                  "
                >
                  {/* Event Image Placeholder */}
                  {event.imageUrl ? (
                    <div className="w-full h-48 mb-4 rounded-lg overflow-hidden bg-gray-200">
                      <img
                        src={event.imageUrl}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-48 mb-4 rounded-lg bg-gradient-to-br from-[#10B8D9]/10 to-[#00993E]/10 flex items-center justify-center">
                      <div className="text-4xl">📅</div>
                    </div>
                  )}

                  {/* Event Title */}
                  <h3 className="text-xl font-bold text-[#1E1F1C] mb-3 group-hover:text-[#10B8D9] transition-colors line-clamp-2">
                    {event.title}
                  </h3>

                  {/* Event Details */}
                  <div className="space-y-2 mb-4">
                    {event.location && (
                      <div className="flex items-start gap-2 text-sm text-[#1E1F1C]/70">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="line-clamp-1">{event.location}</span>
                      </div>
                    )}
                    {event.date && (
                      <div className="flex items-start gap-2 text-sm text-[#1E1F1C]/70">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{event.date}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {event.description && (
                    <p className="text-sm text-[#1E1F1C]/60 mb-4 line-clamp-3">
                      {event.description}
                    </p>
                  )}

                  {/* Link Indicator */}
                  <div className="flex items-center gap-2 text-[#10B8D9] text-sm font-medium group-hover:gap-3 transition-all">
                    <span>{t.sideEvents?.viewEvent || 'View Event'}</span>
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </motion.a>
              ))}
            </div>

            {/* CTA to Luma */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-12 text-center"
            >
              <a
                href="https://luma.com/taiwan-digital-nomad-hub?k=c"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  inline-block px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg
                  bg-[#1E1F1C] text-white border-2 border-[#1E1F1C]
                  hover:bg-[#1E1F1C]/90
                  transition-all duration-200 shadow-lg hover:shadow-xl
                  transform hover:scale-105
                  flex items-center gap-2 mx-auto
                "
              >
                {t.sideEvents?.viewAllEvents || 'View All Events on Luma'}
                <ExternalLink className="w-5 h-5" />
              </a>
            </motion.div>
          </div>
        )}
      </div>
    </section>
  );
}
