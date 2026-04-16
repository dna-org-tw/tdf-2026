import type { Metadata } from 'next';
import IntroDeck from '@/components/intro/IntroDeck';
import { buildScheduleFromEntries, type LumaApiEntry } from '@/lib/lumaSchedule';
import { getSpeakersFromEntries } from '@/lib/lumaSpeakers';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Introduction',
  description:
    'Taiwan Digital Fest 2026 — a month-long digital nomad festival in Taitung & Hualien, May 2026.',
};

const LUMA_API_URL =
  'https://api2.luma.com/calendar/get-items?calendar_api_id=cal-S2KwfjOEzcZl8E8&pagination_limit=100&period=future';

async function fetchLumaData() {
  try {
    const res = await fetch(LUMA_API_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { events: [], speakers: [] };
    const data = (await res.json()) as { entries?: LumaApiEntry[] };
    const entries = data.entries ?? [];
    return {
      events: buildScheduleFromEntries(entries),
      speakers: getSpeakersFromEntries(entries),
    };
  } catch {
    return { events: [], speakers: [] };
  }
}

export default async function IntroPage() {
  const { events, speakers } = await fetchLumaData();

  return (
    <main style={{ height: '100svh', overflow: 'hidden', background: 'var(--color-dark-gray)' }}>
      <style>{`
        /* Color overrides — Tailwind v4 @theme vars conflict with built-in scales */
        .intro-yellow { color: #FFD028 !important; }
        .intro-cyan { color: #10B8D9 !important; }
        .intro-pink { color: #F9D2E5 !important; }
        .intro-ocean { color: #004E9D !important; }
        .intro-forest { color: #00993E !important; }
        .intro-magenta { color: #C54090 !important; }
        .bg-intro-ocean { background-color: #004E9D !important; }
        .bg-intro-yellow { background-color: #FFD028 !important; }
        .border-intro-forest { border-color: #00993E !important; }
        .border-intro-ocean { border-color: #004E9D !important; }
        .border-intro-magenta { border-color: #C54090 !important; }
        .border-intro-yellow { border-color: #FFD028 !important; }
        #slide-container {
          height: 100svh;
          overflow-y: auto;
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
        }
        [data-slide] {
          min-height: 100svh;
          scroll-snap-align: start;
          scroll-snap-stop: always;
        }
        @media print {
          #slide-container {
            overflow: visible !important;
            height: auto !important;
            scroll-snap-type: none !important;
          }
          [data-slide] {
            break-after: page;
            page-break-after: always;
            min-height: 100vh !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          nav, footer, .no-print {
            display: none !important;
          }
        }
        @page {
          size: landscape;
          margin: 0;
        }
      `}</style>
      <IntroDeck
        events={events.map((e) => ({
          title: e.title,
          startDate: e.startDate,
          location: e.location,
          imageUrl: e.imageUrl,
        }))}
        speakers={speakers.map((s) => ({
          name: s.name,
          avatarUrl: s.avatarUrl,
        }))}
      />
    </main>
  );
}
