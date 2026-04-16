'use client';

import { useMemo, useSyncExternalStore } from 'react';
import type { Registration } from '@/lib/lumaSyncTypes';

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

  if (registrations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-5 py-6 text-center">
        <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-slate-400 mb-2">
          {lang === 'zh' ? '我的活動' : 'My events'}
        </p>
        <p className="text-sm text-slate-500">
          {lang === 'zh' ? '尚未報名任何活動' : 'No event registrations yet'}
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl bg-white shadow-sm overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
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
    </section>
  );
}

function EventRow({ reg, lang, past }: { reg: Registration; lang: 'en' | 'zh'; past: boolean }) {
  const start = reg.startAt ? new Date(reg.startAt) : null;
  const status = reg.activityStatus ? STATUS_LABELS[reg.activityStatus] : null;
  const isCheckedIn = !!reg.checkedInAt;

  const content = (
    <div className={`flex items-center gap-3 px-5 py-3.5 ${past ? 'opacity-55' : ''}`}>
      {/* Date tile */}
      <div className="shrink-0 w-12 h-14 rounded-lg bg-stone-100 flex flex-col items-center justify-center">
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
          {isCheckedIn && (
            <span className="text-[10px] font-mono tracking-wide uppercase text-[#00993E]">
              ✓ {lang === 'zh' ? '已簽到' : 'Checked-in'}
            </span>
          )}
          {status && !isCheckedIn && (
            <span className={`text-[10px] px-2 py-[1px] rounded-full font-medium ${TONE_CLASSES[status.tone]}`}>
              {status[lang]}
            </span>
          )}
        </div>
      </div>

      {reg.url && !past && (
        <span className="shrink-0 text-slate-300 group-hover:text-slate-700" aria-hidden>
          →
        </span>
      )}
    </div>
  );

  if (reg.url) {
    return (
      <li>
        <a
          href={reg.url}
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
