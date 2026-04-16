'use client';

import { useMemo, useSyncExternalStore } from 'react';
import type { Registration } from '@/lib/lumaSyncTypes';

const LUMA_CALENDAR_URL = 'https://lu.ma/calendar/cal-S2KwfjOEzcZl8E8';
const FESTIVAL_START = new Date('2026-05-01T00:00:00+08:00');
const FESTIVAL_END = new Date('2026-05-31T23:59:59+08:00');

function diffDays(target: Date, now: Date) {
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

interface Props {
  registrations: Registration[];
  lang: 'en' | 'zh';
  noShowConsumedCount: number;
}

const STATUS_LABELS: Record<string, { zh: string; en: string; tone: 'pos' | 'warn' | 'neutral' | 'neg' }> = {
  approved: { zh: '已核准', en: 'Approved', tone: 'pos' },
  pending_approval: { zh: '審核中', en: 'Pending', tone: 'warn' },
  waitlist: { zh: '候補中', en: 'Waitlist', tone: 'warn' },
  invited: { zh: '已邀請', en: 'Invited', tone: 'neutral' },
  declined: { zh: '已拒絕', en: 'Declined', tone: 'neg' },
};

const TONE_CLASSES = {
  pos: 'bg-[#00993E]/15 text-[#00993E]',
  warn: 'bg-[#FFD028]/20 text-[#A67800]',
  neutral: 'bg-slate-200 text-slate-700',
  neg: 'bg-slate-200 text-slate-500',
};

function formatMonth(d: Date, lang: 'en' | 'zh') {
  return lang === 'zh'
    ? `${d.getMonth() + 1}月`
    : d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

function formatTime(d: Date, lang: 'en' | 'zh') {
  if (lang === 'zh') {
    const dow = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return `週${dow} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

let cachedNow: number | null = null;
const subscribe = (cb: () => void) => {
  cachedNow = Date.now();
  cb();
  return () => {};
};
const getServerSnapshot = () => null;
const getClientSnapshot = () => cachedNow;

export default function UpcomingEvents({ registrations, lang, noShowConsumedCount }: Props) {
  const now = useSyncExternalStore<number | null>(subscribe, getClientSnapshot, getServerSnapshot);

  const { upcoming, past } = useMemo(() => {
    const sorted = [...registrations].sort((a, b) => {
      const at = a.startAt ? new Date(a.startAt).getTime() : 0;
      const bt = b.startAt ? new Date(b.startAt).getTime() : 0;
      return at - bt;
    });
    if (now == null) {
      return { upcoming: sorted, past: [] as Registration[] };
    }
    return {
      upcoming: sorted.filter((r) => r.startAt && new Date(r.startAt).getTime() >= now),
      past: sorted.filter((r) => r.startAt && new Date(r.startAt).getTime() < now),
    };
  }, [registrations, now]);

  // Festival countdown
  const countdownLine = (() => {
    if (now == null) return null;
    const nowDate = new Date(now);
    const daysToStart = diffDays(FESTIVAL_START, nowDate);
    const daysToEnd = diffDays(FESTIVAL_END, nowDate);
    const isLive = daysToStart <= 0 && daysToEnd >= 0;
    const isPast = daysToEnd < 0;

    if (isPast) return lang === 'zh' ? 'TDF 2026 已圓滿結束' : 'TDF 2026 has wrapped';
    if (isLive) {
      const day = 31 - daysToEnd;
      return lang === 'zh' ? `節慶第 ${day} 天 · 還有 ${daysToEnd} 天` : `Day ${day} of festival · ${daysToEnd} days left`;
    }
    return lang === 'zh' ? `距離開幕 ${daysToStart} 天` : `${daysToStart} days until kick-off`;
  })();

  // Count no-shows: past approved events without check-in
  const noShowCount = useMemo(() => {
    return past.filter((r) => r.activityStatus === 'approved' && !r.checkedInAt).length;
  }, [past]);

  if (registrations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-5 py-6 text-center">
        {countdownLine && (
          <p className="text-[11px] font-mono text-slate-400 mb-2">{countdownLine}</p>
        )}
        <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-slate-400 mb-2">
          {lang === 'zh' ? '我的活動' : 'My events'}
        </p>
        <p className="text-sm text-slate-500 mb-4">
          {lang === 'zh' ? '尚未報名任何活動' : 'No event registrations yet'}
        </p>
        <a
          href={LUMA_CALENDAR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-mono tracking-[0.15em] uppercase text-[#10B8D9] hover:underline"
        >
          {lang === 'zh' ? '前往報名活動' : 'Browse & register events'}
          <span aria-hidden>→</span>
        </a>
      </div>
    );
  }

  return (
    <section className="rounded-2xl bg-white shadow-sm overflow-hidden">
      {/* Header: title row + countdown */}
      <header className="px-5 pt-4 pb-3 border-b border-stone-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display font-bold text-slate-900 text-base leading-tight">
              {lang === 'zh' ? '我的活動' : 'My Events'}
            </p>
            <p className="mt-0.5 text-[11px] font-mono text-slate-400">
              {countdownLine}
              {countdownLine && (upcoming.length > 0 ? ' · ' : '')}
              {upcoming.length > 0
                ? lang === 'zh'
                  ? `${upcoming.length} 場即將開始`
                  : `${upcoming.length} upcoming`
                : null}
            </p>
          </div>
          <a
            href={LUMA_CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 mt-0.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#10B8D9] bg-[#10B8D9]/8 hover:bg-[#10B8D9]/15 transition-colors"
          >
            {lang === 'zh' ? '報名' : 'Register'}
            <span aria-hidden>→</span>
          </a>
        </div>
      </header>

      {/* Event list */}
      <ul className="divide-y divide-stone-100">
        {upcoming.map((r) => (
          <EventRow key={r.eventApiId} reg={r} lang={lang} past={false} />
        ))}
        {upcoming.length === 0 && past.slice(0, 3).map((r) => (
          <EventRow key={r.eventApiId} reg={r} lang={lang} past />
        ))}
      </ul>

      {/* Past events */}
      {past.length > 0 && upcoming.length > 0 && (
        <details className="border-t border-stone-100 group">
          <summary className="px-5 py-3 cursor-pointer text-[12px] font-mono tracking-[0.2em] uppercase text-slate-400 hover:text-slate-600 list-none flex items-center justify-between transition-colors">
            <span>
              {lang === 'zh' ? `過往活動 (${past.length})` : `Past events (${past.length})`}
            </span>
            <span className="transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <ul className="divide-y divide-stone-100">
            {past.map((r) => (
              <EventRow key={r.eventApiId} reg={r} lang={lang} past />
            ))}
          </ul>
        </details>
      )}

      {/* Footer: no-show warning + check-in rule */}
      <footer className="border-t border-stone-100">
        {noShowCount > 0 && (
          <div className="px-5 py-2.5 bg-red-50/50 border-b border-red-100/60 flex items-center gap-2">
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" aria-hidden />
            <p className="text-[11px] text-red-600/90 leading-snug">
              {lang === 'zh'
                ? `${noShowCount} 次未到場${noShowConsumedCount > 0 ? `，已消化 ${noShowConsumedCount} 次` : ''}${noShowCount - noShowConsumedCount > 0 ? `（剩餘 ${noShowCount - noShowConsumedCount} 次待消化）` : '（已全部消化）'}`
                : `${noShowCount} no-show${noShowCount > 1 ? 's' : ''}${noShowConsumedCount > 0 ? ` — ${noShowConsumedCount} consumed` : ''}${noShowCount - noShowConsumedCount > 0 ? ` (${noShowCount - noShowConsumedCount} remaining)` : ' (all consumed)'}`}
            </p>
          </div>
        )}
        <div className="px-5 py-2.5">
          <p className="text-[11px] text-slate-400 leading-snug">
            {lang === 'zh'
              ? '請務必到場簽到，未簽到將喪失一次報名資格。'
              : 'Check in at registered events. No-shows lose one future registration.'}
          </p>
        </div>
      </footer>
    </section>
  );
}

function lumaUrl(slug: string | null): string | null {
  if (!slug) return null;
  if (slug.startsWith('http')) return slug;
  return `https://lu.ma/${slug}`;
}

function CheckInBadge({ reg, lang, past }: { reg: Registration; lang: 'en' | 'zh'; past: boolean }) {
  const isCheckedIn = !!reg.checkedInAt;
  const isPast = past;
  const needsCheckin = isPast && !isCheckedIn;

  if (isCheckedIn) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-[2px] rounded-full font-medium bg-[#00993E]/15 text-[#00993E]">
        <svg viewBox="0 0 16 16" className="w-3 h-3" aria-hidden>
          <path d="M3 8.5l3 3 7-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {lang === 'zh' ? '已簽到' : 'Checked-in'}
      </span>
    );
  }

  if (needsCheckin) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-[2px] rounded-full font-medium bg-red-100 text-red-600">
        <svg viewBox="0 0 16 16" className="w-3 h-3" aria-hidden>
          <path d="M8 3v6M8 11.5v.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {lang === 'zh' ? '未簽到' : 'No show'}
      </span>
    );
  }

  return null;
}

function getWaitlistLabel(reg: Registration, lang: 'en' | 'zh'): { label: string; tone: 'pos' | 'warn' | 'neutral' | 'neg' } | null {
  if (reg.activityStatus !== 'waitlist') return null;
  if (reg.reviewReason === 'waitlist:no_show_penalty') {
    return {
      label: lang === 'zh' ? '候補中（消化未到場）' : 'Waitlisted (no-show)',
      tone: 'warn',
    };
  }
  return { label: lang === 'zh' ? '候補中' : 'Waitlist', tone: 'warn' };
}

function EventRow({ reg, lang, past }: { reg: Registration; lang: 'en' | 'zh'; past: boolean }) {
  const start = reg.startAt ? new Date(reg.startAt) : null;
  const status = reg.activityStatus ? STATUS_LABELS[reg.activityStatus] : null;
  const isCheckedIn = !!reg.checkedInAt;
  const href = lumaUrl(reg.url);

  // Date tile color based on approval status
  const isApproved = reg.activityStatus === 'approved';
  const isPending = reg.activityStatus === 'pending_approval' || reg.activityStatus === 'waitlist';
  const tileClasses = past
    ? 'bg-stone-100'
    : isApproved
      ? 'bg-[#00993E]/10'
      : isPending
        ? 'bg-[#FFD028]/10'
        : 'bg-stone-100';

  const content = (
    <div className={`flex gap-3 px-5 py-3 ${past && !isCheckedIn ? 'opacity-55' : past ? 'opacity-70' : ''}`}>
      {/* Date tile */}
      <div className={`shrink-0 w-11 h-12 rounded-lg flex flex-col items-center justify-center ${tileClasses}`}>
        {start ? (
          <>
            <span className="text-[8px] font-mono uppercase text-slate-500/80 leading-none tracking-wide">
              {formatMonth(start, lang)}
            </span>
            <span className="font-display font-black text-lg text-slate-900 leading-none mt-0.5">
              {start.getDate()}
            </span>
          </>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-900 truncate text-[13px] leading-tight">
            {reg.eventName}
          </p>
          {/* Approval status badge — inline with title for upcoming */}
          {!past && (() => {
            const waitlistOverride = getWaitlistLabel(reg, lang);
            if (waitlistOverride) {
              return (
                <span className={`shrink-0 text-[10px] px-1.5 py-[1px] rounded-full font-medium leading-none ${TONE_CLASSES[waitlistOverride.tone]}`}>
                  {waitlistOverride.label}
                </span>
              );
            }
            if (status) {
              return (
                <span className={`shrink-0 text-[10px] px-1.5 py-[1px] rounded-full font-medium leading-none ${TONE_CLASSES[status.tone]}`}>
                  {status[lang]}
                </span>
              );
            }
            return null;
          })()}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {start && (
            <span className="text-[11px] text-slate-400">{formatTime(start, lang)}</span>
          )}
          <CheckInBadge reg={reg} lang={lang} past={past} />
        </div>
      </div>

      {href && !past && (
        <span className="shrink-0 self-center text-slate-300 group-hover:text-[#10B8D9] transition-colors" aria-hidden>
          →
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <li>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="group block hover:bg-stone-50 transition-colors"
        >
          {content}
        </a>
      </li>
    );
  }
  return <li>{content}</li>;
}
