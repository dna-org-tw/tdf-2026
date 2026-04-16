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

export default function UpcomingEvents({ registrations, lang }: Props) {
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
      <header className="px-5 py-4 border-b border-stone-100">
        {countdownLine && (
          <p className="text-[11px] font-mono text-slate-400 mb-1.5">{countdownLine}</p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-slate-400">
              {lang === 'zh' ? '我的活動' : 'My events'}
            </p>
            <p className="font-display font-bold text-slate-900 text-lg leading-tight">
              {upcoming.length > 0
                ? lang === 'zh'
                  ? `即將參加 ${upcoming.length} 場`
                  : `${upcoming.length} upcoming`
                : lang === 'zh'
                  ? '已無即將舉辦的活動'
                  : 'No upcoming events'}
            </p>
          </div>
          <a
            href={LUMA_CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] font-mono tracking-[0.1em] text-[#10B8D9] hover:underline"
          >
            {lang === 'zh' ? '報名活動' : 'Register'}
            <span aria-hidden> →</span>
          </a>
        </div>
      </header>

      <ul className="divide-y divide-stone-100">
        {upcoming.map((r) => (
          <EventRow key={r.eventApiId} reg={r} lang={lang} past={false} />
        ))}
        {upcoming.length === 0 && past.slice(0, 3).map((r) => (
          <EventRow key={r.eventApiId} reg={r} lang={lang} past />
        ))}
      </ul>

      {past.length > 0 && upcoming.length > 0 && (
        <details className="border-t border-stone-100 group">
          <summary className="px-5 py-3 cursor-pointer text-[12px] font-mono tracking-[0.2em] uppercase text-slate-500 hover:text-slate-700 list-none flex items-center justify-between">
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

      {/* No-show warning */}
      {noShowCount > 0 && (
        <div className="border-t border-red-100 bg-red-50/60 px-5 py-3 flex items-start gap-2.5">
          <svg viewBox="0 0 16 16" className="w-4 h-4 mt-0.5 shrink-0 text-red-500" aria-hidden>
            <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM8 4v5M8 11v1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-[12px] text-red-700 leading-relaxed">
            {lang === 'zh'
              ? `你有 ${noShowCount} 場活動報名成功但未到場簽到，已喪失 ${noShowCount} 次報名資格。`
              : `You have ${noShowCount} no-show${noShowCount > 1 ? 's' : ''} — ${noShowCount} registration opportunity lost.`}
          </p>
        </div>
      )}

      {/* Check-in rule */}
      <div className="border-t border-stone-100 px-5 py-3">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {lang === 'zh'
            ? '報名成功後請務必到場簽到。未到場簽到將喪失一次活動報名資格。'
            : 'Please check in at events you register for. Each no-show costs one future registration opportunity.'}
        </p>
      </div>
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
    <div className={`flex items-center gap-3 px-5 py-3.5 ${past && !isCheckedIn ? 'opacity-60' : past ? 'opacity-75' : ''}`}>
      {/* Date tile */}
      <div className={`shrink-0 w-12 h-14 rounded-lg flex flex-col items-center justify-center ${tileClasses}`}>
        {start ? (
          <>
            <span className="text-[9px] font-mono uppercase text-slate-500 leading-none">
              {formatMonth(start, lang)}
            </span>
            <span className="font-display font-black text-xl text-slate-900 leading-none mt-1">
              {start.getDate()}
            </span>
          </>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900 truncate text-[14px] leading-tight">
          {reg.eventName}
        </p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {start && (
            <span className="text-[11px] text-slate-500">{formatTime(start, lang)}</span>
          )}
          {/* Approval status badge — always show for upcoming, show for past only if not approved */}
          {status && !past && (
            <span className={`text-[10px] px-2 py-[1px] rounded-full font-medium ${TONE_CLASSES[status.tone]}`}>
              {status[lang]}
            </span>
          )}
          {/* Check-in badge */}
          <CheckInBadge reg={reg} lang={lang} past={past} />
        </div>
      </div>

      {href && !past && (
        <span className="shrink-0 text-slate-300 group-hover:text-[#10B8D9]" aria-hidden>
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
