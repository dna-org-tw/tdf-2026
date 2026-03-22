'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent } from '@/components/FacebookPixel';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import { useLumaData } from '@/contexts/LumaDataContext';
import { toTaipeiParts, type CalendarEvent } from '@/lib/lumaSchedule';

type TicketTier = 'follower' | 'explorer' | 'contributor' | 'backer' | 'other';

const TICKET_TIER_ORDER: TicketTier[] = ['follower', 'explorer', 'contributor', 'backer', 'other'];

const TICKET_FILTER_OPTIONS: (TicketTier | 'all')[] = ['all', ...TICKET_TIER_ORDER];

// 篩選器按鈕：依票券級別顏色（active 實心 / inactive 框線+淺底）
const FILTER_BUTTON_CLASS: Record<TicketTier | 'all', { active: string; inactive: string }> = {
  all: { active: 'bg-stone-500 text-white border-stone-500', inactive: 'bg-white/80 text-[#1E1F1C] border-stone-300 hover:border-stone-500 hover:bg-stone-50' },
  follower: { active: 'bg-purple-500 text-white border-purple-500', inactive: 'bg-white/80 text-[#1E1F1C] border-purple-200 hover:border-purple-400 hover:bg-purple-50' },
  explorer: { active: 'bg-blue-500 text-white border-blue-500', inactive: 'bg-white/80 text-[#1E1F1C] border-blue-200 hover:border-blue-400 hover:bg-blue-50' },
  contributor: { active: 'bg-green-600 text-white border-green-600', inactive: 'bg-white/80 text-[#1E1F1C] border-green-200 hover:border-green-400 hover:bg-green-50' },
  backer: { active: 'bg-amber-400 text-[#1E1F1C] border-amber-400', inactive: 'bg-white/80 text-[#1E1F1C] border-amber-200 hover:border-amber-400 hover:bg-amber-50' },
  other: { active: 'bg-stone-300 text-[#1E1F1C] border-stone-400', inactive: 'bg-white/80 text-[#1E1F1C] border-stone-300 hover:border-stone-400 hover:bg-stone-100' },
};

export default function EventsSection() {
  const { t, lang } = useTranslation();
  const { events: contextEvents } = useLumaData();
  const [selectedTierFilter, setSelectedTierFilter] = useState<TicketTier | 'all'>('all');

  const allEvents = useMemo(
    () =>
      contextEvents.filter(
        (event) =>
          event.url &&
          event.title &&
          (event.visibility ?? '').toLowerCase() !== 'private'
      ),
    [contextEvents]
  );

  useSectionTracking({ sectionId: 'events', sectionName: 'Events Section', category: 'Event Information' });

  // Get the lowest tier ticket type from event tags
  // Ticket tier hierarchy (lowest to highest): follower < explorer < contributor < backer
  const getLowestTicketTier = (event: CalendarEvent): TicketTier | null => {
    // Get tag names from tags array (preferred) or fallback to eligibility
    const tagsFromTags = event.tags?.map(tag => tag.name.toLowerCase()) || [];
    const tagsFromEligibility = event.eligibility?.map(tag => tag.toLowerCase().replace('#', '')) || [];
    const tagNames = tagsFromTags.length > 0 ? tagsFromTags : tagsFromEligibility;
    
    // Check for ticket tier tags in order from lowest to highest
    const tierOrder: TicketTier[] = ['follower', 'explorer', 'contributor', 'backer', 'other'];
    
    for (const tier of tierOrder) {
      if (tier !== 'other' && tagNames.includes(tier)) {
        return tier;
      }
    }
    
    // If no tier tag found, return null (will be categorized as "side event")
    return null;
  };

  // 取得事件實際使用的票種等級（無標籤則視為 side event）
  const getEventTicketTier = (event: CalendarEvent): TicketTier => {
    const lowest = getLowestTicketTier(event);
    return lowest ?? 'other';
  };

  // 依票券等級篩選活動：
  // - All：顯示全部
  // - Follower/Explorer/Contributor/Backer：顯示「小於等於」該等級的活動
  // - Side Event：僅顯示 side event（無對應票券標籤）的活動
  const filteredByTicketTier = allEvents.filter((event) => {
    if (selectedTierFilter === 'all') return true;

    const eventTier = getEventTicketTier(event);
    if (selectedTierFilter === 'other') {
      return eventTier === 'other';
    }

    const eventIndex = TICKET_TIER_ORDER.indexOf(eventTier);
    const selectedIndex = TICKET_TIER_ORDER.indexOf(selectedTierFilter);

    if (eventIndex === -1 || selectedIndex === -1) return true;
    return eventIndex <= selectedIndex;
  });

  // 只取 5 月份的活動，並依週分組
  const parseEventDate = (event: CalendarEvent) => {
    try {
      return new Date(event.startDate);
    } catch {
      return null;
    }
  };

  // 日曆網格：7:00–23:00，每小時一欄
  const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const WEEK_THEMES = [
    { start: 1, end: 7, theme: 'Regional Revitalization & Startups' },
    { start: 8, end: 14, theme: 'Art, Humanities & Design' },
    { start: 15, end: 21, theme: 'Culture, Tourism & Experience' },
    { start: 22, end: 28, theme: 'Technology, Remote & Co-creation' },
    { start: 29, end: 31, theme: 'Tour' },
  ];

  const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const mayDays = Array.from({ length: 31 }, (_, i) => {
    // Use noon UTC to avoid date boundary issues when converting to Taipei
    const d = new Date(Date.UTC(2026, 4, i + 1, 4)); // 4:00 UTC = 12:00 Taipei
    const { dayOfWeek } = toTaipeiParts(d);
    const weekInfo = WEEK_THEMES.find((w) => i + 1 >= w.start && i + 1 <= w.end);
    return {
      dayIndex: i,
      label: `5/${i + 1} ${DAY_NAMES[dayOfWeek]}`,
      dateKey: `2026-05-${String(i + 1).padStart(2, '0')}`,
      theme: weekInfo?.theme ?? '',
    };
  });

  // 展開跨日活動為每天一段（首日 startH–24:00、中間日 08:00–24:00、末日 08:00–endH）
  // 所有時間以 Asia/Taipei 時區計算
  const getEventSegments = (event: CalendarEvent): { dayIndex: number; startH: number; endH: number }[] => {
    if (!event.startTime) {
      const date = parseEventDate(event);
      if (!date) return [];
      const tp = toTaipeiParts(date);
      if (tp.year !== 2026 || tp.month !== 5) return [];
      return [{ dayIndex: tp.day - 1, startH: 7, endH: 8 }];
    }

    const start = new Date(event.startTime);
    const end = event.endTime ? new Date(event.endTime) : new Date(start.getTime() + 3600000);

    const startTp = toTaipeiParts(start);
    const endTp = toTaipeiParts(end);

    const isMayTp = (tp: { year: number; month: number }) => tp.year === 2026 && tp.month === 5;

    // May 1 00:00 and June 1 00:00 in Taipei (UTC+8)
    const mayFirstMs = Date.UTC(2026, 3, 30, 16, 0, 0); // 2026-05-01T00:00:00+08:00
    const juneFirstMs = Date.UTC(2026, 4, 31, 16, 0, 0); // 2026-06-01T00:00:00+08:00
    if (end.getTime() <= mayFirstMs || start.getTime() >= juneFirstMs) return [];

    const effEndMs = end.getTime() > juneFirstMs ? juneFirstMs : end.getTime();
    const effEndTp = toTaipeiParts(new Date(effEndMs));

    let firstDay = isMayTp(startTp) ? startTp.day : 1;
    let lastDay: number;

    if (effEndTp.hour === 0 && effEndTp.minute === 0) {
      lastDay = isMayTp(effEndTp) ? effEndTp.day - 1 : 31;
    } else {
      lastDay = isMayTp(effEndTp) ? effEndTp.day : 31;
    }

    if (lastDay < 1) return [];
    firstDay = Math.max(1, Math.min(31, firstDay));
    lastDay = Math.max(1, Math.min(31, lastDay));

    const clamp = (sH: number, eH: number) => {
      sH = Math.max(7, Math.min(23, sH));
      eH = Math.max(sH + 1, Math.min(24, eH));
      return { startH: sH, endH: eH };
    };

    if (firstDay === lastDay) {
      const sH = isMayTp(startTp) && startTp.day === firstDay ? startTp.hour : 7;
      let eH: number;
      if (isMayTp(endTp) && endTp.day === firstDay) {
        eH = endTp.hour + (endTp.minute > 0 ? 1 : 0);
        if (eH === 0) eH = 24;
      } else {
        eH = 24;
      }
      const c = clamp(sH, eH);
      return [{ dayIndex: firstDay - 1, ...c }];
    }

    const segments: { dayIndex: number; startH: number; endH: number }[] = [];
    for (let day = firstDay; day <= lastDay; day++) {
      let sH: number, eH: number;
      if (day === firstDay && isMayTp(startTp) && startTp.day === firstDay) {
        sH = startTp.hour;
        eH = 24;
      } else if (day === lastDay && isMayTp(endTp) && endTp.day === lastDay) {
        sH = 7;
        eH = endTp.hour + (endTp.minute > 0 ? 1 : 0);
      } else {
        sH = 7;
        eH = 24;
      }
      const c = clamp(sH, eH);
      segments.push({ dayIndex: day - 1, ...c });
    }
    return segments;
  };

  // 活動區塊背景色（依票種或輪替）
  // 活動方塊底色：依最低可參與票券級別
  const TIER_BG_CLASS: Record<TicketTier, string> = {
    follower: 'bg-purple-100 border-purple-200',
    explorer: 'bg-blue-100 border-blue-200',
    contributor: 'bg-green-100 border-green-200',
    backer: 'bg-yellow-100 border-yellow-200',
    other: 'bg-white border-stone-200',
  };

  const getEventBlockColor = (event: CalendarEvent) => {
    const tier = getEventTicketTier(event);
    return TIER_BG_CLASS[tier];
  };

  // 依「日」分組已篩選的活動（含跨日展開），並附上網格位置
  const eventsByDay = (() => {
    const allSegments: { dayIndex: number; startH: number; endH: number; event: CalendarEvent }[] = [];
    for (const event of filteredByTicketTier) {
      for (const seg of getEventSegments(event)) {
        allSegments.push({ ...seg, event });
      }
    }
    return mayDays.map((day) => {
      const events = allSegments
        .filter((s) => s.dayIndex === day.dayIndex)
        .map(({ event, startH, endH }) => ({
          event,
          startCol: startH - 7,
          span: endH - startH,
          color: getEventBlockColor(event),
        }));
      return { ...day, events };
    });
  })();

  // 日曆網格：本體列數 = 31 天 + 每週（分隔列 + 時間標籤列）
  const BODY_ROW_COUNT = 31 + WEEK_THEMES.length * 2;

  // 每週分隔列所在的 grid row（無表頭，+1 轉為 1-based）
  // 每週佔 2 列（主題 + 時間標籤），所以之前的週數 × 2
  const getWeekSeparatorGridRow = (weekIndex: number) => {
    const week = WEEK_THEMES[weekIndex];
    const daysBefore = week.start - 1;
    const extraRowsBefore = weekIndex * 2;
    const bodyRowIndex = daysBefore + extraRowsBefore;
    return bodyRowIndex + 1;
  };

  // 某一天所在的 grid row（含所有在它之前的分隔列 + 時間標籤列）
  const getDayGridRow = (dayIndex: number) => {
    const dayNumber = dayIndex + 1;
    const weeksBeforeCount = WEEK_THEMES.filter((w) => w.start <= dayNumber).length;
    const extraRows = weeksBeforeCount * 2;
    const bodyRowIndex = dayIndex + extraRows;
    return bodyRowIndex + 1;
  };


  const renderTicketFilter = () => (
    <div className="flex flex-wrap justify-center gap-3">
      {TICKET_FILTER_OPTIONS.map((tier) => {
        const isActive = selectedTierFilter === tier;
        const labelMap: Record<TicketTier | 'all', string> = {
          all: 'All',
          follower: 'Follower',
          explorer: 'Explorer',
          contributor: 'Contributor',
          backer: 'Backer',
          other: 'Side Event',
        };

        return (
          <button
            key={tier}
            type="button"
            onClick={() => {
              setSelectedTierFilter(tier);
              trackEvent('SelectContent', {
                content_type: 'product_filter',
                content_name: 'Events Ticket Tier',
                content_category: 'Event Information',
                tier,
                location: 'events_section',
              });
            }}
            className={`
              px-4 py-2 rounded-full text-sm md:text-base font-semibold border
              transition-all duration-200 shadow-sm
              ${isActive ? FILTER_BUTTON_CLASS[tier].active : FILTER_BUTTON_CLASS[tier].inactive}
            `}
          >
            {labelMap[tier]}
          </button>
        );
      })}
    </div>
  );

  const handleEventClick = (event: CalendarEvent) => {
    if (event.url) {
      trackEvent('Lead', {
        content_name: 'Luma Event Link',
        content_category: 'Event Carousel',
        event_title: event.title,
        event_url: event.url,
        location: 'events_section',
      });
      window.open(event.url, '_blank', 'noopener,noreferrer');
    }
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

        {/* 票種篩選器 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          {renderTicketFilter()}
        </motion.div>
      </div>

      {/* 日曆網格：固定高度，縱向可捲動；日期、頂部 8:00–21:00，活動方塊依時段放置 */}
      <div className="container mx-auto px-4 sm:px-6 overflow-x-auto mt-2">
        <div
          className="inline-block min-w-[800px] border border-[#D4D4CF] rounded-xl bg-white shadow-sm"
          style={{
            display: 'grid',
            gridTemplateColumns: `min-content repeat(${HOURS.length}, 1fr)`,
            gridTemplateRows: `repeat(${BODY_ROW_COUNT}, auto)`,
          }}
        >
          {/* 每週分隔列：主題 + 時間標籤（淡灰底） */}
          {WEEK_THEMES.map((w, weekIndex) => {
            const gridRow = getWeekSeparatorGridRow(weekIndex);
            const weekNumbers = lang === 'zh'
              ? ['第一週', '第二週', '第三週', '第四週', '第五週']
              : ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
            const rawTheme = t.schedule?.weekThemes?.[weekIndex] ?? w.theme;
            const themeLabel = `${weekNumbers[weekIndex]}：${rawTheme}`;
            const timeLabelRow = gridRow + 1;
            return (
              <React.Fragment key={`week-separator-${w.start}-${w.end}`}>
                <div
                  className="border-b border-[#D4D4CF] bg-[#1E1F1C] px-3 py-4 text-xs sm:text-sm font-bold text-white flex items-center justify-center leading-tight"
                  style={{ gridRow, gridColumn: '1 / -1' }}
                  title={themeLabel}
                >
                  <span className="text-center">
                    {themeLabel}
                  </span>
                </div>
                {/* 時間標籤列 */}
                <div
                  className="border-b border-r border-[#D4D4CF] bg-stone-200 px-2 py-0 text-[10px] font-semibold text-[#1E1F1C]/50 flex items-center"
                  style={{ gridRow: timeLabelRow, gridColumn: 1 }}
                >
                  Date
                </div>
                {HOURS.map((h, i) => (
                  <div
                    key={`week-time-${weekIndex}-${h}`}
                    className="border-b border-r border-[#D4D4CF] bg-stone-200 px-1 py-0 text-center text-[10px] font-medium text-[#1E1F1C]/50 flex items-center justify-center"
                    style={{ gridRow: timeLabelRow, gridColumn: i + 2 }}
                  >
                    {h}:00
                  </div>
                ))}
              </React.Fragment>
            );
          })}

          {/* 每一行 = 一天：日期 | 14 個時間格 */}
          {eventsByDay.map((day) => {
            const gridRow = getDayGridRow(day.dayIndex);
            return (
              <React.Fragment key={day.dateKey}>
                <div
                  className="border-b border-r border-[#D4D4CF] px-2 py-1.5 text-xs font-medium text-[#1E1F1C]"
                  style={{ gridRow, gridColumn: 1 }}
                >
                  {day.label}
                </div>
                {HOURS.map((_, colIdx) => (
                  <div
                    key={`${day.dateKey}-${colIdx}`}
                    className="border-b border-r border-[#E7E5E4] bg-white min-h-[52px]"
                    style={{ gridRow, gridColumn: colIdx + 2 }}
                  />
                ))}
              </React.Fragment>
            );
          })}

          {/* 活動方塊：網格直接子元素，依 gridColumn 跨欄 */}
          {eventsByDay.map((day) => {
            const gridRow = getDayGridRow(day.dayIndex);
            return day.events.map(({ event, startCol, span, color }) => (
              <motion.div
                key={`${day.dateKey}-${event.title}-${event.startTime ?? ''}`}
                initial={{ opacity: 0.9 }}
                animate={{ opacity: 1 }}
                className={`border rounded overflow-hidden ${color} cursor-pointer hover:shadow-md transition-shadow text-left flex items-stretch min-w-0 min-h-[44px]`}
                style={{
                  gridRow,
                  gridColumn: `${startCol + 2} / span ${span}`,
                  zIndex: 5,
                  margin: 2,
                }}
                onClick={() => event.url && handleEventClick(event)}
              >
                {event.imageUrl ? (
                  <div className="flex-shrink-0 w-10 h-full min-h-[40px] relative bg-stone-200">
                    <Image
                      src={event.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                ) : null}
                <div className="flex flex-col justify-center py-1 px-2 min-w-0 flex-1">
                  <span className="text-xs font-semibold text-[#1E1F1C] truncate block" title={event.title}>
                    {event.title}
                  </span>
                  {event.location ? (
                    <span className="text-[10px] text-[#1E1F1C]/70 truncate block" title={event.location}>
                      @{event.location}
                    </span>
                  ) : null}
                </div>
              </motion.div>
            ));
          })}
        </div>
      </div>

      {/* 日曆下方票種篩選器 */}
      <div className="container mx-auto px-4 sm:px-6 mt-8">
        {renderTicketFilter()}
      </div>

      {/* Venue disclaimer + CTA Buttons */}
      <div className="container mx-auto px-4 sm:px-6">
        <p className="mt-6 text-center text-sm text-[#1E1F1C]/60">
          {t.schedule?.venueDisclaimer}
        </p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-4 text-center flex flex-wrap justify-center gap-3 sm:gap-4"
        >
          <a
            href="https://forms.gle/EofTp9Qso27jEeeY7"
            target="_blank"
            rel="noopener noreferrer"
                    onClick={() => {
                      trackEvent('Lead', {
                        content_name: 'Call for Side Events',
                        content_category: 'CTA',
                        location: 'events_section',
                      });
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
              trackEvent('Lead', {
                content_name: 'Call for Speakers',
                content_category: 'CTA',
                location: 'events_section',
              });
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

    </section>
  );
}
