'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface CalendarEvent {
  title: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string | null;
  startTime?: string | null;
  eligibility?: string[];
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  date: number;
}

export default function EventModal({ isOpen, onClose, events, date }: EventModalProps) {
  const { t } = useTranslation();
  if (!isOpen || events.length === 0) return null;

  const getGoogleMapsUrl = (location: string) => {
    const encodedLocation = encodeURIComponent(location);
    return `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1E1F1C] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-[#1E1F1C]/70">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#1E1F1C]/70">
                <div>
                  <h3 className="text-2xl font-display font-bold text-white mb-1">
                    2026{t.eventModal.day} {date}{t.eventModal.daySuffix}
                  </h3>
                  <p className="text-sm text-[#F6F6F6]/60">
                    {events.length} {events.length === 1 ? t.eventModal.event : t.eventModal.events}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-[#1E1F1C]/80 transition-colors text-[#F6F6F6]/60 hover:text-white"
                  aria-label={t.eventModal.close}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-6">
                  {events.map((event, index) => (
                    <div
                      key={index}
                      className="border-b border-[#1E1F1C]/50 last:border-0 pb-6 last:pb-0"
                    >
                      {/* Title */}
                      <div className="mb-3">
                        <h4 className="text-xl font-bold text-white mb-2">
                          {formatTime(event.startTime) && (
                            <span className="font-medium text-[#F6F6F6]/70 mr-2">
                              {formatTime(event.startTime)}
                            </span>
                          )}
                          {event.title}
                        </h4>
                        {/* Eligibility Tags */}
                        {event.eligibility && event.eligibility.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {event.eligibility.map((tag, tagIdx) => {
                              const tagMap: { [key: string]: { bg: string; text: string; border: string; labelKey: 'explorerLabel' | 'contributorLabel' | 'backerLabel' } } = {
                                '#explorer': { bg: 'bg-[#10B8D9]/20', text: 'text-[#10B8D9]', border: 'border-[#10B8D9]/40', labelKey: 'explorerLabel' },
                                '#contributor': { bg: 'bg-[#00993E]/20', text: 'text-[#00993E]', border: 'border-[#00993E]/40', labelKey: 'contributorLabel' },
                                '#backer': { bg: 'bg-[#FFD028]/20', text: 'text-[#FFD028]', border: 'border-[#FFD028]/40', labelKey: 'backerLabel' },
                              };
                              const tagConfig = tagMap[tag.toLowerCase()] || { bg: 'bg-[#1E1F1C]/50', text: 'text-[#F6F6F6]/70', border: 'border-[#1E1F1C]/70', labelKey: null };
                              const label = tagConfig.labelKey ? t.timeline[tagConfig.labelKey] : tag;
                              
                              return (
                                <span
                                  key={tagIdx}
                                  className={`text-xs px-2.5 py-1 rounded-full border ${tagConfig.bg} ${tagConfig.text} ${tagConfig.border} font-medium`}
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Date Range */}
                      <div className="flex items-center gap-2 mb-3 text-sm text-[#F6F6F6]/80">
                        <svg
                          className="w-4 h-4 text-[#10B8D9]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>
                          {event.startDate === event.endDate || !event.endDate
                            ? event.startDate
                            : `${event.startDate} - ${event.endDate}`}
                        </span>
                      </div>

                      {/* Location */}
                      {event.location && (
                        <div className="flex items-start gap-2 mb-3 text-sm">
                          <svg
                            className="w-4 h-4 text-[#10B8D9] flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <a
                            href={getGoogleMapsUrl(event.location)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 leading-relaxed text-[#10B8D9] hover:text-[#10B8D9]/80 transition-colors flex items-center gap-1.5 group"
                          >
                            <span className="flex-1">{event.location}</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </a>
                        </div>
                      )}

                      {/* Description */}
                      {event.description && (
                        <div 
                          className="mt-4 text-sm text-[#F6F6F6]/70 leading-relaxed
                            [&_h1]:text-white [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-4
                            [&_h2]:text-white [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 [&_h2]:mt-3
                            [&_h3]:text-white [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-3
                            [&_h4]:text-white [&_h4]:text-base [&_h4]:font-bold [&_h4]:mb-2 [&_h4]:mt-2
                            [&_p]:mb-3 [&_p]:leading-relaxed
                            [&_a]:text-[#10B8D9] [&_a]:no-underline [&_a:hover]:text-[#10B8D9]/80 [&_a:hover]:underline
                            [&_strong]:text-white [&_strong]:font-bold
                            [&_em]:italic
                            [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-3 [&_ul]:space-y-1
                            [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-3 [&_ol]:space-y-1
                            [&_li]:mb-1
                            [&_code]:text-[#10B8D9] [&_code]:bg-[#1E1F1C]/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                            [&_pre]:bg-[#1E1F1C]/50 [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:mb-3
                            [&_blockquote]:border-l-4 [&_blockquote]:border-[#1E1F1C]/70 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[#F6F6F6]/80 [&_blockquote]:my-3
                            [&_hr]:border-[#1E1F1C]/70 [&_hr]:my-4
                            [&_img]:rounded-lg [&_img]:my-3 [&_img]:max-w-full
                            [&_table]:w-full [&_table]:mb-3 [&_table]:border-collapse
                            [&_th]:border [&_th]:border-[#1E1F1C]/70 [&_th]:px-3 [&_th]:py-2 [&_th]:bg-[#1E1F1C]/50 [&_th]:text-white [&_th]:font-bold
                            [&_td]:border [&_td]:border-[#1E1F1C]/70 [&_td]:px-3 [&_td]:py-2 [&_td]:text-[#F6F6F6]/60"
                          dangerouslySetInnerHTML={{ __html: event.description }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
