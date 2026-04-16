'use client';

import { Suspense } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import SlideController from './SlideController';

interface LumaEvent {
  title: string;
  startDate: string;
  location: string;
  imageUrl?: string;
}

interface Speaker {
  name: string;
  avatarUrl: string | null;
}

interface IntroDeckProps {
  events: LumaEvent[];
  speakers: Speaker[];
}

/* ── helpers ── */
const fs = (min: string, vw: string, max: string) =>
  ({ fontSize: `clamp(${min}, ${vw}, ${max})` }) as React.CSSProperties;

const YELLOW = '#FFD028';
const CYAN = '#10B8D9';
const PINK = '#F9D2E5';
const OCEAN = '#004E9D';
const FOREST = '#00993E';

function Slide({
  children,
  index,
  style,
  className = '',
}: {
  children: React.ReactNode;
  index: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <section
      data-slide={index}
      className={`flex flex-col items-center justify-center overflow-hidden ${className}`}
      style={{ padding: '3vh 4vw', ...style }}
    >
      {children}
    </section>
  );
}

function SlideDeckInner({ events, speakers }: IntroDeckProps) {
  const { t, lang } = useTranslation();
  const totalSlides = 13;

  const uniqueSpeakers = speakers.filter(
    (s, i, arr) => arr.findIndex((x) => x.name === s.name) === i
  );

  const eventDates = events
    .map((e) => new Date(e.startDate))
    .filter((d) => !isNaN(d.getTime()));
  const dateRange =
    eventDates.length > 0
      ? {
          start: new Date(Math.min(...eventDates.map((d) => d.getTime()))),
          end: new Date(Math.max(...eventDates.map((d) => d.getTime()))),
        }
      : null;

  const eventsWithImages = events.filter(e => e.imageUrl);

  return (
    <>
      <div id="slide-container">
        {/* 1 — Cover */}
        <Slide index={0} style={{ background: '#1E1F1C', color: '#fff' }}>
          <h1
            className="text-center font-display tracking-tighter"
            style={{ ...fs('4rem', '13vw', '14rem'), fontWeight: 900, lineHeight: 0.95 }}
          >
            Taiwan
            <br />
            Digital Fest
            <br />
            <span style={{ color: YELLOW }}>2026</span>
          </h1>
          <p
            className="text-center"
            style={{ ...fs('1.6rem', '4vw', '3.5rem'), fontWeight: 600, marginTop: '3vh', maxWidth: '80vw', opacity: 0.7 }}
          >
            {t.hero.subtitle}
          </p>
          <p
            className="text-center"
            style={{ ...fs('1.2rem', '2.8vw', '2.2rem'), fontWeight: 600, marginTop: '2vh', opacity: 0.4 }}
          >
            {t.hero.dateLocation}
          </p>
        </Slide>

        {/* 2 — About */}
        <Slide index={1} style={{ background: '#fff', color: '#1E1F1C' }}>
          <h2
            className="text-center font-display"
            style={{ ...fs('3rem', '9vw', '8rem'), fontWeight: 900, color: OCEAN, marginBottom: '3vh' }}
          >
            {t.about.title}
          </h2>
          <p
            className="text-center"
            style={{ ...fs('1.2rem', '2.5vw', '2rem'), fontWeight: 500, lineHeight: 1.5, maxWidth: '82vw', opacity: 0.75 }}
          >
            {t.about.description.split('\n\n')[0]}
          </p>
          <div className="flex flex-wrap justify-center" style={{ gap: '1vw', marginTop: '2vh' }}>
            {t.about.tags.map((tag: string) => (
              <span
                key={tag}
                className="rounded-full"
                style={{ ...fs('1rem', '1.8vw', '1.4rem'), fontWeight: 700, color: OCEAN, background: 'rgba(0,78,157,0.1)', padding: '0.6vh 1.8vw' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </Slide>

        {/* 3 — Event Info */}
        <Slide index={2} style={{ background: '#F6F6F6', color: '#1E1F1C' }}>
          <h2
            className="text-center font-display"
            style={{ ...fs('3rem', '9vw', '8rem'), fontWeight: 900, marginBottom: '4vh' }}
          >
            {t.about.info.title}
          </h2>
          <div className="grid w-full sm:grid-cols-3" style={{ maxWidth: '85vw', gap: '3vw' }}>
            {[
              { label: t.about.info.time, value: t.about.info.timeValue, icon: '📅' },
              { label: t.about.info.location, value: t.about.info.locationValue, icon: '📍' },
              { label: t.about.info.theme, value: t.about.info.themeValue, icon: '🎯' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center rounded-3xl bg-white text-center shadow-xl"
                style={{ padding: '3vh 2vw' }}
              >
                <span style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', marginBottom: '1.5vh' }}>{item.icon}</span>
                <span style={{ ...fs('1rem', '1.8vw', '1.4rem'), fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.4, marginBottom: '0.5vh' }}>
                  {item.label}
                </span>
                <span style={{ ...fs('1.3rem', '2.5vw', '2rem'), fontWeight: 900 }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </Slide>

        {/* 4 — Why Taiwan */}
        <Slide index={3} style={{ background: OCEAN, color: '#fff' }}>
          <h2
            className="text-center font-display"
            style={{ ...fs('2.5rem', '8vw', '7rem'), fontWeight: 900, marginBottom: '2vh', lineHeight: 1.05 }}
          >
            {t.why.taiwan.title}
          </h2>
          <p
            className="text-center"
            style={{ ...fs('1.1rem', '2.2vw', '1.8rem'), fontWeight: 600, maxWidth: '75vw', opacity: 0.7, marginBottom: '3vh' }}
          >
            {t.why.taiwan.desc}
          </p>
          <div className="grid w-full grid-cols-2 sm:grid-cols-3" style={{ maxWidth: '85vw', gap: '1.5vw' }}>
            {t.why.reasons.map((r: { icon: string; text: string }) => (
              <div
                key={r.text}
                className="flex items-center rounded-2xl"
                style={{ gap: '1.5vw', background: 'rgba(255,255,255,0.1)', padding: '2vh 2vw' }}
              >
                <span style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}>{r.icon}</span>
                <span style={{ ...fs('1rem', '2vw', '1.6rem'), fontWeight: 700 }}>{r.text}</span>
              </div>
            ))}
          </div>
        </Slide>

        {/* 5 — Taitung & Hualien with photos */}
        <Slide index={4} style={{ background: '#fff', color: '#1E1F1C' }}>
          <div className="grid w-full md:grid-cols-2" style={{ maxWidth: '90vw', gap: '2vw' }}>
            {(() => {
              const taitungImg = events.find(e => /taitung|台東/i.test(e.title) || /taitung|台東/i.test(e.location))?.imageUrl;
              const hualienImg = events.find(e => /hualien|花蓮/i.test(e.title) || /hualien|花蓮/i.test(e.location))?.imageUrl;
              return [
                { ...t.why.taitung, img: taitungImg },
                { ...t.why.hualien, img: hualienImg },
              ].map((place: { title: string; desc: string; img?: string }) => (
                <div key={place.title} className="overflow-hidden rounded-2xl" style={{ background: '#F6F6F6' }}>
                  {place.img && (
                    <img src={place.img} alt={place.title} className="w-full object-cover" style={{ height: '30vh' }} />
                  )}
                  <div style={{ padding: '2vh 2vw' }}>
                    <h3
                      className="font-display"
                      style={{ ...fs('1.6rem', '3.5vw', '2.8rem'), fontWeight: 900, color: OCEAN, marginBottom: '0.5vh', lineHeight: 1.1 }}
                    >
                      {place.title}
                    </h3>
                    <p style={{ ...fs('0.9rem', '1.4vw', '1.1rem'), fontWeight: 500, lineHeight: 1.4, opacity: 0.55 }}>
                      {place.desc.length > 100 ? place.desc.slice(0, 100) + '…' : place.desc}
                    </p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </Slide>

        {/* 6 — Highlights: photo-first cards matched by keyword */}
        <Slide index={5} style={{ background: YELLOW, color: '#1E1F1C' }}>
          <h2
            className="text-center font-display"
            style={{ ...fs('2.5rem', '7vw', '6rem'), fontWeight: 900, marginBottom: '2vh' }}
          >
            {t.highlights.title}
          </h2>
          <div className="grid w-full sm:grid-cols-2 lg:grid-cols-3" style={{ maxWidth: '92vw', gap: '1vw' }}>
            {(() => {
              const keywords = [
                ['opening', 'party', '開幕'],
                ['nomad', 'activity', '遊牧', 'digital'],
                ['buffet', 'outdoor', '饗宴', '戶外'],
                ['vip', 'lunch', 'dinner', '午餐', '晚餐'],
                ['hualien', '花蓮', 'trip', '旅行'],
                ['vvip', '體驗', 'experience'],
              ];
              return t.highlights.items.map((item: { title: string; summary: string }, idx: number) => {
                const kws = keywords[idx] || [];
                const matched = events.find(e =>
                  kws.some(k => e.title.toLowerCase().includes(k))
                );
                const img = matched?.imageUrl || events[idx]?.imageUrl;
                return (
                  <div
                    key={item.title}
                    className="relative overflow-hidden rounded-2xl shadow-lg"
                    style={{ height: 'calc((100vh - 14vh) / 2 - 1.5vw)' }}
                  >
                    {img && (
                      <img src={img} alt={item.title} className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)' }} />
                    <div className="absolute bottom-0 left-0 right-0" style={{ padding: '1.2vw', color: '#fff' }}>
                      <h4 style={{ ...fs('0.95rem', '1.4vw', '1.2rem'), fontWeight: 900, lineHeight: 1.2 }}>
                        {item.title}
                      </h4>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </Slide>

        {/* 7 — Event Photo Gallery (more photos, smaller) */}
        <Slide index={6} style={{ background: '#1E1F1C', color: '#fff', padding: '2vh 2vw' }}>
          <div className="grid w-full grid-cols-4 sm:grid-cols-5 lg:grid-cols-6" style={{ maxWidth: '96vw', gap: '0.5vw' }}>
            {eventsWithImages.slice(0, 24).map((e, i) => (
              <div key={i} className="relative overflow-hidden rounded-lg" style={{ height: 'calc((100vh - 8vh) / 4 - 0.5vw)' }}>
                <img src={e.imageUrl} alt={e.title} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)' }} />
                <span className="absolute bottom-0 left-0 right-0" style={{ ...fs('0.6rem', '0.8vw', '0.75rem'), fontWeight: 700, padding: '0.4vw', color: '#fff', lineHeight: 1.2 }}>
                  {e.title.length > 25 ? e.title.slice(0, 25) + '…' : e.title}
                </span>
              </div>
            ))}
          </div>
        </Slide>

        {/* 8 — Schedule / Stats */}
        <Slide index={7} style={{ background: '#1E1F1C', color: '#fff' }}>
          <h2
            className="text-center font-display"
            style={{ ...fs('3rem', '9vw', '8rem'), fontWeight: 900, marginBottom: '4vh' }}
          >
            {t.schedule.title}
          </h2>
          <div className="grid w-full sm:grid-cols-3" style={{ maxWidth: '85vw', gap: '3vw' }}>
            {[
              { value: `${events.length}+`, label: lang === 'zh' ? '場活動' : 'Events', color: YELLOW },
              { value: `${uniqueSpeakers.length}+`, label: lang === 'zh' ? '位講者' : 'Speakers', color: CYAN },
              { value: '31', label: lang === 'zh' ? '天' : 'Days', color: PINK },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <span
                  className="font-display"
                  style={{ fontSize: 'clamp(5rem, 16vw, 13rem)', fontWeight: 900, lineHeight: 1, color: stat.color }}
                >
                  {stat.value}
                </span>
                <span style={{ ...fs('1.3rem', '2.5vw', '2rem'), fontWeight: 700, opacity: 0.6 }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
          {dateRange && (
            <p className="text-center" style={{ ...fs('1rem', '1.8vw', '1.3rem'), fontWeight: 700, opacity: 0.3, marginTop: '2vh' }}>
              {dateRange.start.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'long', day: 'numeric' })}
              {' – '}
              {dateRange.end.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          <div className="flex flex-wrap justify-center" style={{ gap: '0.6vw', marginTop: '1.5vh' }}>
            {t.schedule.weekThemes.map((theme: string, i: number) => (
              <span
                key={i}
                className="rounded-full"
                style={{ ...fs('0.85rem', '1.3vw', '1.05rem'), fontWeight: 700, border: '2px solid rgba(255,255,255,0.2)', padding: '0.4vh 1.2vw', opacity: 0.5 }}
              >
                {t.schedule.themeWeekLabel} {i + 1}: {theme}
              </span>
            ))}
          </div>
        </Slide>

        {/* 9 — Tickets */}
        <Slide index={8} style={{ background: '#fff', color: '#1E1F1C' }}>
          <h2
            className="text-center font-display"
            style={{ ...fs('3rem', '9vw', '8rem'), fontWeight: 900, color: OCEAN, marginBottom: '3vh' }}
          >
            {t.tickets.title}
          </h2>
          <div className="grid w-full sm:grid-cols-2 lg:grid-cols-4" style={{ maxWidth: '90vw', gap: '1.2vw' }}>
            {(
              [
                { key: 'explore', border: FOREST, bg: 'rgba(0,153,62,0.1)' },
                { key: 'contribute', border: OCEAN, bg: 'rgba(0,78,157,0.1)' },
                { key: 'weekly_backer', border: '#C54090', bg: 'rgba(197,64,144,0.1)' },
                { key: 'backer', border: YELLOW, bg: 'rgba(255,208,40,0.2)' },
              ] as const
            ).map(({ key, border, bg }) => {
              const tier = t.tickets[key] as { name: string; features: string[] };
              return (
                <div
                  key={key}
                  className="rounded-2xl"
                  style={{ border: `3px solid ${border}`, background: bg, padding: '1.5vw' }}
                >
                  <h4 className="text-center" style={{ ...fs('1.3rem', '2.2vw', '1.8rem'), fontWeight: 900, marginBottom: '1vh' }}>
                    {tier.name}
                  </h4>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.4vh' }}>
                    {tier.features.slice(0, 4).map((f: string) => (
                      <li key={f} className="flex items-start" style={{ ...fs('0.85rem', '1.3vw', '1.05rem'), fontWeight: 700, opacity: 0.65, gap: '0.4vw' }}>
                        <span style={{ color: FOREST }}>✓</span>
                        {f}
                      </li>
                    ))}
                    {tier.features.length > 4 && (
                      <li style={{ ...fs('0.85rem', '1.3vw', '1.05rem'), fontWeight: 700, opacity: 0.35 }}>
                        +{tier.features.length - 4} more
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </Slide>

        {/* 10 — Speakers */}
        <Slide index={9} style={{ background: '#F6F6F6', color: '#1E1F1C' }}>
          <h2
            className="text-center font-display"
            style={{ ...fs('3rem', '9vw', '8rem'), fontWeight: 900, marginBottom: '3vh' }}
          >
            {t.partners.speakers.title}
          </h2>
          <div className="flex flex-wrap items-center justify-center" style={{ maxWidth: '90vw', gap: '1.5vw' }}>
            {uniqueSpeakers.slice(0, 24).map((s) => (
              <div key={s.name} className="flex flex-col items-center" style={{ gap: '0.3vh' }}>
                {s.avatarUrl ? (
                  <img
                    src={s.avatarUrl}
                    alt={s.name}
                    className="rounded-full object-cover shadow-md"
                    style={{ width: 'clamp(3.5rem,5.5vw,5rem)', height: 'clamp(3.5rem,5.5vw,5rem)' }}
                  />
                ) : (
                  <div
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 'clamp(3.5rem,5.5vw,5rem)', height: 'clamp(3.5rem,5.5vw,5rem)', background: 'rgba(0,78,157,0.2)', color: OCEAN, fontWeight: 900, fontSize: 'clamp(1.2rem,2.2vw,2rem)' }}
                  >
                    {s.name[0]}
                  </div>
                )}
                <span className="truncate text-center" style={{ maxWidth: '6vw', ...fs('0.7rem', '1vw', '0.85rem'), fontWeight: 700 }}>
                  {s.name}
                </span>
              </div>
            ))}
            {uniqueSpeakers.length > 24 && (
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 'clamp(3.5rem,5.5vw,5rem)', height: 'clamp(3.5rem,5.5vw,5rem)', background: 'rgba(0,0,0,0.1)', fontWeight: 900, fontSize: 'clamp(1rem,1.6vw,1.3rem)', opacity: 0.5 }}
              >
                +{uniqueSpeakers.length - 24}
              </div>
            )}
          </div>
        </Slide>

        {/* 11 — Organizers */}
        <Slide index={10} style={{ background: OCEAN, color: '#fff' }}>
          <h2
            className="text-center font-display"
            style={{ ...fs('3rem', '9vw', '8rem'), fontWeight: 900, marginBottom: '4vh' }}
          >
            {t.partners.organizers.title}
          </h2>
          <div className="grid w-full sm:grid-cols-2" style={{ maxWidth: '85vw', gap: '3vw' }}>
            <div className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.1)', padding: '3vh 2.5vw' }}>
              <h3 className="font-display" style={{ ...fs('1.6rem', '3vw', '2.5rem'), fontWeight: 900, marginBottom: '1.5vh' }}>
                TDNA
              </h3>
              <p style={{ ...fs('0.95rem', '1.5vw', '1.15rem'), fontWeight: 500, opacity: 0.7, lineHeight: 1.5 }}>
                {t.partners.organizers.tdna.description.length > 120
                  ? t.partners.organizers.tdna.description.slice(0, 120) + '…'
                  : t.partners.organizers.tdna.description}
              </p>
            </div>
            <div className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.1)', padding: '3vh 2.5vw' }}>
              <h3 className="font-display" style={{ ...fs('1.6rem', '3vw', '2.5rem'), fontWeight: 900, marginBottom: '1.5vh' }}>
                {lang === 'zh' ? '臺東縣政府' : 'Taitung County Gov.'}
              </h3>
              <p style={{ ...fs('0.95rem', '1.5vw', '1.15rem'), fontWeight: 500, opacity: 0.7, lineHeight: 1.5 }}>
                {t.partners.organizers.taitungGov.description.length > 120
                  ? t.partners.organizers.taitungGov.description.slice(0, 120) + '…'
                  : t.partners.organizers.taitungGov.description}
              </p>
            </div>
          </div>
        </Slide>

        {/* 12 — Co-organizers & Partners */}
        <Slide index={11} style={{ background: '#F6F6F6', color: '#1E1F1C' }}>
          <h2
            className="text-center font-display"
            style={{ ...fs('2.5rem', '7vw', '6rem'), fontWeight: 900, marginBottom: '3vh' }}
          >
            {t.partners.coOrganizers.title} & {t.partners.partners.title}
          </h2>
          <div className="grid w-full sm:grid-cols-2 lg:grid-cols-4" style={{ maxWidth: '90vw', gap: '1.2vw' }}>
            {[
              t.partners.coOrganizers.nanhueiAlliance,
              t.partners.coOrganizers.yuanNatural,
              t.partners.coOrganizers.rootsCoworking,
              t.partners.coOrganizers.herflow,
            ].map((org: { name: string; description: string }) => (
              <div key={org.name} className="rounded-2xl bg-white shadow-lg" style={{ padding: '2vh 1.2vw' }}>
                <h4 style={{ ...fs('1rem', '1.6vw', '1.3rem'), fontWeight: 900, color: OCEAN, marginBottom: '0.8vh', lineHeight: 1.2 }}>
                  {org.name}
                </h4>
                <p style={{ ...fs('0.8rem', '1.1vw', '0.95rem'), fontWeight: 600, opacity: 0.5, lineHeight: 1.4 }}>
                  {org.description.length > 60 ? org.description.slice(0, 60) + '…' : org.description}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center" style={{ gap: '2vw', marginTop: '3vh' }}>
            <span className="rounded-full" style={{ ...fs('1rem', '1.8vw', '1.3rem'), fontWeight: 900, background: OCEAN, color: '#fff', padding: '1.2vh 2.5vw' }}>
              {t.partners.sponsors.cta.text}
            </span>
            <span className="rounded-full" style={{ ...fs('1rem', '1.8vw', '1.3rem'), fontWeight: 900, background: YELLOW, color: '#1E1F1C', padding: '1.2vh 2.5vw' }}>
              {t.partners.partners.cta.text}
            </span>
          </div>
        </Slide>

        {/* 13 — CTA */}
        <Slide index={12} style={{ background: OCEAN, color: '#fff' }}>
          <h2
            className="text-center font-display"
            style={{ ...fs('3rem', '10vw', '9rem'), fontWeight: 900, lineHeight: 0.95, marginBottom: '3vh' }}
          >
            {t.register.title}
          </h2>
          <p
            className="text-center"
            style={{ ...fs('1.5rem', '3.5vw', '2.8rem'), fontWeight: 600, maxWidth: '70vw', opacity: 0.75, marginBottom: '4vh' }}
          >
            {t.register.subtitle}
          </p>
          <div className="flex flex-col items-center sm:flex-row" style={{ gap: '1.5vw' }}>
            <a
              href="/"
              className="rounded-full transition-transform hover:scale-105"
              style={{ ...fs('1.3rem', '2.5vw', '2rem'), fontWeight: 900, background: YELLOW, color: '#1E1F1C', padding: '2vh 3vw' }}
            >
              {t.tickets.payWithCard}
            </a>
            <a
              href={`/?lang=${lang}#follow-us`}
              className="rounded-full transition-transform hover:scale-105"
              style={{ ...fs('1.3rem', '2.5vw', '2rem'), fontWeight: 700, border: '3px solid rgba(255,255,255,0.4)', color: '#fff', padding: '2vh 3vw' }}
            >
              {t.tickets.followerCta}
            </a>
          </div>
          <p className="text-center" style={{ ...fs('1.1rem', '2vw', '1.5rem'), fontWeight: 700, opacity: 0.3, marginTop: '4vh' }}>
            taiwandigitalfest.com
          </p>
        </Slide>
      </div>

      <Suspense fallback={null}>
        <SlideController totalSlides={totalSlides} />
      </Suspense>
    </>
  );
}

export default function IntroDeck(props: IntroDeckProps) {
  return (
    <Suspense fallback={null}>
      <SlideDeckInner {...props} />
    </Suspense>
  );
}
