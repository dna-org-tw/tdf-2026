'use client';

import { useSyncExternalStore } from 'react';

const FESTIVAL_START = new Date('2026-05-01T00:00:00+08:00');
const FESTIVAL_END = new Date('2026-05-31T23:59:59+08:00');

interface NextEvent {
  name: string;
  startAt: string;
  url: string | null;
}

interface Props {
  lang: 'en' | 'zh';
  nextEvent?: NextEvent | null;
}

function diffDays(target: Date, now: Date) {
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function formatEventTime(iso: string, lang: 'en' | 'zh') {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (lang === 'zh') {
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

let cachedNowMs: number | null = null;
const subscribe = (cb: () => void) => {
  cachedNowMs = Date.now();
  cb();
  const t = setInterval(() => {
    cachedNowMs = Date.now();
    cb();
  }, 60_000);
  return () => clearInterval(t);
};
const getClientSnapshotMs = () => cachedNowMs;
const getServerSnapshotMs = () => null;

export default function FestivalCountdown({ lang, nextEvent }: Props) {
  const nowMs = useSyncExternalStore<number | null>(
    subscribe,
    getClientSnapshotMs,
    getServerSnapshotMs,
  );
  const now = nowMs ? new Date(nowMs) : null;

  if (!now) {
    return <div className="h-[148px] rounded-2xl bg-stone-200/50 animate-pulse" />;
  }

  const daysToStart = diffDays(FESTIVAL_START, now);
  const daysToEnd = diffDays(FESTIVAL_END, now);
  const isLive = daysToStart <= 0 && daysToEnd >= 0;
  const isPast = daysToEnd < 0;

  let primary: string;
  let primaryLabel: string;
  let secondary: string;

  if (isPast) {
    primary = '—';
    primaryLabel = lang === 'zh' ? '感謝參與' : 'Thank you';
    secondary = lang === 'zh' ? 'TDF 2026 已圓滿結束' : 'TDF 2026 has wrapped';
  } else if (isLive) {
    primary = `Day ${31 - daysToEnd}`;
    primaryLabel = lang === 'zh' ? '節慶進行中' : 'Festival live';
    secondary = lang === 'zh' ? `5 月 1 日 → 5 月 31 日 · 還有 ${daysToEnd} 天` : `May 1 → May 31 · ${daysToEnd} days remaining`;
  } else {
    primary = `T-${daysToStart}`;
    primaryLabel = lang === 'zh' ? '距離開幕' : 'Until kick-off';
    secondary = lang === 'zh' ? '2026 年 5 月 1 日・台東 ⇄ 花蓮' : 'May 1, 2026 · Taitung ⇄ Hualien';
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#1E1F1C] text-white">
      {/* Animated noise/sun */}
      <div
        className="absolute -right-10 -top-10 w-48 h-48 rounded-full blur-3xl opacity-60"
        style={{ background: 'radial-gradient(circle,#FFD028,#E74310 60%,transparent)' }}
        aria-hidden
      />
      <div
        className="absolute -left-16 -bottom-12 w-56 h-56 rounded-full blur-3xl opacity-40"
        style={{ background: 'radial-gradient(circle,#10B8D9,transparent)' }}
        aria-hidden
      />

      {/* Marker */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-[#FFD028]' : 'bg-white/40'} ${isLive ? 'animate-pulse' : ''}`}
        />
        <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-white/60">
          TDF · 2026
        </span>
      </div>

      <div className="relative px-6 py-7 sm:px-8 sm:py-9">
        <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-white/55">
          {primaryLabel}
        </p>
        <p
          className="leading-[0.85] tracking-tighter mt-2"
          style={{
            fontFamily: 'var(--font-display), var(--font-noto-sans-tc), system-ui, sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(54px, 15vw, 84px)',
          }}
        >
          {primary}
        </p>
        <p className="text-[13px] text-white/65 mt-3">{secondary}</p>

        {nextEvent && (
          <a
            href={nextEvent.url ?? '#'}
            target={nextEvent.url ? '_blank' : undefined}
            rel={nextEvent.url ? 'noopener noreferrer' : undefined}
            className="group mt-7 flex items-center gap-4 rounded-xl border px-4 py-3.5 hover:bg-white/[0.08] transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <div
              className="shrink-0 w-11 h-12 rounded-lg flex flex-col items-center justify-center"
              style={{ background: 'linear-gradient(180deg,#FFD028,#E74310)', color: '#1E1F1C' }}
            >
              <span className="text-[9px] font-mono leading-none">
                {new Date(nextEvent.startAt).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </span>
              <span className="font-display font-black text-lg leading-none mt-0.5">
                {new Date(nextEvent.startAt).getDate()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-mono tracking-[0.25em] uppercase text-white/45">
                {lang === 'zh' ? '你的下一場' : 'Your next event'}
              </p>
              <p className="font-semibold text-white truncate">{nextEvent.name}</p>
              <p className="text-[12px] text-white/55">{formatEventTime(nextEvent.startAt, lang)}</p>
            </div>
            <span className="text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all">
              →
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
