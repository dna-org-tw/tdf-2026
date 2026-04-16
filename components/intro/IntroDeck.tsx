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

function Slide({
  children,
  index,
  bg,
  className = '',
}: {
  children: React.ReactNode;
  index: number;
  bg?: string;
  className?: string;
}) {
  return (
    <section
      data-slide={index}
      className={`flex flex-col items-center justify-center px-[5vw] py-[4vh] ${bg ?? ''} ${className}`}
    >
      {children}
    </section>
  );
}

function SlideDeckInner({ events, speakers }: IntroDeckProps) {
  const { t, lang } = useTranslation();

  const totalSlides = 10;

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

  return (
    <>
      <div id="slide-container">
        {/* 1 — Cover */}
        <Slide index={0} bg="bg-dark-gray text-white">
          <h1 className="text-center font-display text-[clamp(4rem,13vw,14rem)] font-black leading-[0.95] tracking-tighter">
            Taiwan
            <br />
            Digital Fest
            <br />
            <span className="intro-yellow">2026</span>
          </h1>
          <p className="mt-[3vh] max-w-[80vw] text-center text-[clamp(1.6rem,4vw,3.5rem)] font-semibold text-white/70">
            {t.hero.subtitle}
          </p>
          <p className="mt-[2vh] text-center text-[clamp(1.2rem,2.8vw,2.2rem)] font-semibold text-white/40">
            {t.hero.dateLocation}
          </p>
        </Slide>

        {/* 2 — About */}
        <Slide index={1} bg="bg-white text-dark-gray">
          <h2 className="intro-ocean mb-[4vh] text-center font-display text-[clamp(3rem,9vw,8rem)] font-black">
            {t.about.title}
          </h2>
          <p className="max-w-[85vw] text-center text-[clamp(1.3rem,2.8vw,2.2rem)] font-medium leading-[1.5] text-dark-gray/75">
            {t.about.description.split('\n\n')[0]}
          </p>
          <div className="mt-[3vh] flex flex-wrap justify-center gap-4">
            {t.about.tags.map((tag: string) => (
              <span
                key={tag}
                className="intro-ocean rounded-full px-8 py-3 text-[clamp(1.1rem,2vw,1.6rem)] font-bold"
                style={{ backgroundColor: 'rgba(0,78,157,0.1)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </Slide>

        {/* 3 — Event Info */}
        <Slide index={2} bg="bg-light-gray text-dark-gray">
          <h2 className="mb-[5vh] text-center font-display text-[clamp(3rem,9vw,8rem)] font-black">
            {t.about.info.title}
          </h2>
          <div className="grid w-full max-w-[85vw] gap-[3vw] sm:grid-cols-3">
            {[
              { label: t.about.info.time, value: t.about.info.timeValue, icon: '📅' },
              { label: t.about.info.location, value: t.about.info.locationValue, icon: '📍' },
              { label: t.about.info.theme, value: t.about.info.themeValue, icon: '🎯' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center rounded-3xl bg-white p-[3vh] text-center shadow-xl"
              >
                <span className="mb-[2vh] text-[clamp(3rem,6vw,5rem)]">{item.icon}</span>
                <span className="mb-2 text-[clamp(1rem,1.8vw,1.4rem)] font-bold uppercase tracking-widest text-dark-gray/40">
                  {item.label}
                </span>
                <span className="text-[clamp(1.3rem,2.5vw,2rem)] font-black">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </Slide>

        {/* 4 — Why Taiwan */}
        <Slide index={3} bg="bg-intro-ocean text-white">
          <h2 className="mb-[3vh] text-center font-display text-[clamp(2.5rem,8vw,7rem)] font-black leading-tight">
            {t.why.taiwan.title}
          </h2>
          <p className="mb-[4vh] max-w-[75vw] text-center text-[clamp(1.2rem,2.5vw,2rem)] font-semibold text-white/70">
            {t.why.taiwan.desc}
          </p>
          <div className="grid w-full max-w-[85vw] grid-cols-2 gap-[2vw] sm:grid-cols-3">
            {t.why.reasons.map((r: { icon: string; text: string }) => (
              <div
                key={r.text}
                className="flex items-center gap-[1.5vw] rounded-2xl bg-white/10 px-[2vw] py-[2.5vh] backdrop-blur-sm"
              >
                <span className="text-[clamp(2rem,4vw,3.5rem)]">{r.icon}</span>
                <span className="text-[clamp(1.1rem,2.2vw,1.8rem)] font-bold">{r.text}</span>
              </div>
            ))}
          </div>
        </Slide>

        {/* 5 — Taitung & Hualien */}
        <Slide index={4} bg="bg-white text-dark-gray">
          <div className="grid w-full max-w-[88vw] gap-[4vw] md:grid-cols-2">
            {[t.why.taitung, t.why.hualien].map(
              (place: { title: string; desc: string }) => (
                <div key={place.title}>
                  <h3 className="intro-ocean mb-[2vh] font-display text-[clamp(2rem,5vw,4rem)] font-black leading-tight">
                    {place.title}
                  </h3>
                  <p className="text-[clamp(1.1rem,2vw,1.5rem)] font-medium leading-[1.6] text-dark-gray/65">
                    {place.desc.length > 180 ? place.desc.slice(0, 180) + '…' : place.desc}
                  </p>
                </div>
              )
            )}
          </div>
        </Slide>

        {/* 6 — Highlights */}
        <Slide index={5} bg="bg-intro-yellow text-dark-gray">
          <h2 className="mb-[4vh] text-center font-display text-[clamp(3rem,9vw,8rem)] font-black">
            {t.highlights.title}
          </h2>
          <div className="grid w-full max-w-[90vw] gap-[1.5vw] sm:grid-cols-2 lg:grid-cols-3">
            {t.highlights.items.map((item: { title: string; summary: string }) => (
              <div
                key={item.title}
                className="rounded-2xl bg-white/90 p-[2vw] shadow-lg"
              >
                <h4 className="mb-2 text-[clamp(1.2rem,2vw,1.6rem)] font-black leading-snug">
                  {item.title}
                </h4>
                <p className="text-[clamp(0.95rem,1.5vw,1.2rem)] font-semibold leading-relaxed text-dark-gray/60">
                  {item.summary.length > 60 ? item.summary.slice(0, 60) + '…' : item.summary}
                </p>
              </div>
            ))}
          </div>
        </Slide>

        {/* 7 — Schedule / Stats */}
        <Slide index={6} bg="bg-dark-gray text-white">
          <h2 className="mb-[5vh] text-center font-display text-[clamp(3rem,9vw,8rem)] font-black">
            {t.schedule.title}
          </h2>
          <div className="grid w-full max-w-[85vw] gap-[3vw] sm:grid-cols-3">
            <div className="flex flex-col items-center">
              <span className="intro-yellow font-display text-[clamp(5rem,16vw,13rem)] font-black leading-none">
                {events.length}+
              </span>
              <span className="text-[clamp(1.3rem,2.5vw,2rem)] font-bold text-white/60">
                {lang === 'zh' ? '場活動' : 'Events'}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="intro-cyan font-display text-[clamp(5rem,16vw,13rem)] font-black leading-none">
                {uniqueSpeakers.length}+
              </span>
              <span className="text-[clamp(1.3rem,2.5vw,2rem)] font-bold text-white/60">
                {lang === 'zh' ? '位講者' : 'Speakers'}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="intro-pink font-display text-[clamp(5rem,16vw,13rem)] font-black leading-none">
                31
              </span>
              <span className="text-[clamp(1.3rem,2.5vw,2rem)] font-bold text-white/60">
                {lang === 'zh' ? '天' : 'Days'}
              </span>
            </div>
          </div>
          {dateRange && (
            <p className="mt-[3vh] text-center text-[clamp(1.1rem,2vw,1.5rem)] font-bold text-white/30">
              {dateRange.start.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', {
                month: 'long',
                day: 'numeric',
              })}{' '}
              –{' '}
              {dateRange.end.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
          <div className="mt-[2vh] flex flex-wrap justify-center gap-3">
            {t.schedule.weekThemes.map((theme: string, i: number) => (
              <span
                key={i}
                className="rounded-full border-2 border-white/20 px-5 py-2 text-[clamp(0.95rem,1.5vw,1.2rem)] font-bold text-white/50"
              >
                {t.schedule.themeWeekLabel} {i + 1}: {theme}
              </span>
            ))}
          </div>
        </Slide>

        {/* 8 — Tickets */}
        <Slide index={7} bg="bg-white text-dark-gray">
          <h2 className="intro-ocean mb-[4vh] text-center font-display text-[clamp(3rem,9vw,8rem)] font-black">
            {t.tickets.title}
          </h2>
          <div className="grid w-full max-w-[90vw] gap-[1.5vw] sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { key: 'explore', border: '#00993E', bg: 'rgba(0,153,62,0.1)' },
                { key: 'contribute', border: '#004E9D', bg: 'rgba(0,78,157,0.1)' },
                { key: 'weekly_backer', border: '#C54090', bg: 'rgba(197,64,144,0.1)' },
                { key: 'backer', border: '#FFD028', bg: 'rgba(255,208,40,0.2)' },
              ] as const
            ).map(({ key, border, bg }) => {
              const tier = t.tickets[key] as {
                name: string;
                features: string[];
              };
              return (
                <div
                  key={key}
                  className="rounded-2xl border-3 p-[1.5vw]"
                  style={{ borderColor: border, backgroundColor: bg }}
                >
                  <h4 className="mb-[1.5vh] text-center text-[clamp(1.4rem,2.5vw,2rem)] font-black">
                    {tier.name}
                  </h4>
                  <ul className="space-y-2">
                    {tier.features.slice(0, 4).map((f: string) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-[clamp(0.95rem,1.5vw,1.2rem)] font-bold text-dark-gray/65"
                      >
                        <span className="intro-forest mt-0.5">✓</span>
                        {f}
                      </li>
                    ))}
                    {tier.features.length > 4 && (
                      <li className="text-[clamp(0.95rem,1.5vw,1.2rem)] font-bold text-dark-gray/35">
                        +{tier.features.length - 4} more
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </Slide>

        {/* 9 — Speakers */}
        <Slide index={8} bg="bg-light-gray text-dark-gray">
          <h2 className="mb-[4vh] text-center font-display text-[clamp(3rem,9vw,8rem)] font-black">
            {t.partners.speakers.title}
          </h2>
          <div className="flex max-w-[88vw] flex-wrap items-center justify-center gap-[2vw]">
            {uniqueSpeakers.slice(0, 18).map((s) => (
              <div key={s.name} className="flex flex-col items-center gap-2">
                {s.avatarUrl ? (
                  <img
                    src={s.avatarUrl}
                    alt={s.name}
                    className="rounded-full object-cover shadow-lg"
                    style={{ width: 'clamp(4rem,7vw,6rem)', height: 'clamp(4rem,7vw,6rem)' }}
                  />
                ) : (
                  <div
                    className="intro-ocean flex items-center justify-center rounded-full font-black"
                    style={{ width: 'clamp(4rem,7vw,6rem)', height: 'clamp(4rem,7vw,6rem)', backgroundColor: 'rgba(0,78,157,0.2)', fontSize: 'clamp(1.5rem,3vw,2.5rem)' }}
                  >
                    {s.name[0]}
                  </div>
                )}
                <span className="max-w-[7vw] truncate text-center text-[clamp(0.85rem,1.3vw,1.1rem)] font-bold">
                  {s.name}
                </span>
              </div>
            ))}
            {uniqueSpeakers.length > 18 && (
              <div
                className="flex items-center justify-center rounded-full bg-dark-gray/10 font-black text-dark-gray/50"
                style={{ width: 'clamp(4rem,7vw,6rem)', height: 'clamp(4rem,7vw,6rem)', fontSize: 'clamp(1.2rem,2vw,1.6rem)' }}
              >
                +{uniqueSpeakers.length - 18}
              </div>
            )}
          </div>
        </Slide>

        {/* 10 — CTA */}
        <Slide index={9} bg="bg-intro-ocean text-white">
          <h2 className="mb-[3vh] text-center font-display text-[clamp(3rem,10vw,9rem)] font-black leading-[0.95]">
            {t.register.title}
          </h2>
          <p className="mb-[5vh] max-w-[70vw] text-center text-[clamp(1.5rem,3.5vw,2.8rem)] font-semibold text-white/75">
            {t.register.subtitle}
          </p>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <a
              href="/"
              className="rounded-full px-[3vw] py-[2vh] text-[clamp(1.3rem,2.5vw,2rem)] font-black text-dark-gray transition-transform hover:scale-105"
              style={{ backgroundColor: '#FFD028' }}
            >
              {t.tickets.payWithCard}
            </a>
            <a
              href={`/?lang=${lang}#follow-us`}
              className="rounded-full border-3 border-white/40 px-[3vw] py-[2vh] text-[clamp(1.3rem,2.5vw,2rem)] font-bold text-white transition-transform hover:scale-105"
            >
              {t.tickets.followerCta}
            </a>
          </div>
          <p className="mt-[5vh] text-center text-[clamp(1.1rem,2vw,1.5rem)] font-bold text-white/30">
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
