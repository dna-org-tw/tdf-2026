'use client';

import Link from 'next/link';
import type { Order } from '@/lib/types/order';

export interface ActionHeroProps {
  lang: 'en' | 'zh';
  orders: Order[];
  daysUntilFestival: number | null;
  daysSinceFestivalStart: number | null;
  visaRequired: boolean;
  firstUpcomingEventName: string | null;
}

type Variant = 'payment-pending' | 'visa-missing' | 'live' | 'countdown' | null;

function pickVariant(p: ActionHeroProps): Variant {
  const pending = p.orders.find((o) => o.status === 'pending' && o.amount_total > 0);
  if (pending) return 'payment-pending';
  if (p.visaRequired) return 'visa-missing';
  if (p.daysSinceFestivalStart != null && p.daysSinceFestivalStart >= 0) return 'live';
  if (p.daysUntilFestival != null && p.daysUntilFestival > 0) return 'countdown';
  return null;
}

export default function ActionHero(p: ActionHeroProps) {
  const variant = pickVariant(p);
  if (!variant) return null;

  if (variant === 'payment-pending') {
    const pending = p.orders.find((o) => o.status === 'pending' && o.amount_total > 0)!;
    const amount = `${(pending.amount_total / 100).toFixed(2)} ${pending.currency.toUpperCase()}`;
    return (
      <section
        aria-label={p.lang === 'zh' ? '付款待辦事項' : 'Payment action required'}
        className="relative overflow-hidden rounded-2xl bg-[#FCE4E4] pl-5 pr-4 sm:pl-6 sm:pr-5 py-4 sm:py-5"
      >
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-[#9B2C2C]" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#9B2C2C]/75">
              {p.lang === 'zh' ? '完成付款' : 'Complete your payment'}
            </p>
            <p className="mt-1 text-[15px] sm:text-base font-semibold text-[#5E1A1A] leading-snug capitalize">
              {p.lang === 'zh'
                ? `${pending.ticket_tier} 票種尚有 ${amount} 待付`
                : `${amount} due for ${pending.ticket_tier} tier`}
            </p>
          </div>
          <Link
            href={`/order/${pending.id}`}
            className="shrink-0 inline-flex items-center justify-center rounded-lg bg-[#9B2C2C] hover:bg-[#7B2222] text-white text-sm font-semibold px-4 py-2.5 transition-colors"
          >
            {p.lang === 'zh' ? '前往付款 →' : 'Pay now →'}
          </Link>
        </div>
      </section>
    );
  }

  if (variant === 'visa-missing') {
    return (
      <section
        aria-label={p.lang === 'zh' ? '簽證待辦事項' : 'Visa action recommended'}
        className="relative overflow-hidden rounded-2xl bg-[#FBEFD4] pl-5 pr-4 sm:pl-6 sm:pr-5 py-4 sm:py-5"
      >
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-[#8A5A0B]" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#8A5A0B]/80">
              {p.lang === 'zh' ? '簽證邀請函' : 'Visa support letter'}
            </p>
            <p className="mt-1 text-[15px] sm:text-base font-semibold text-[#5E3B04] leading-snug">
              {p.lang === 'zh'
                ? '我們可以協助開立邀請函 · 填完資料就能下載 PDF'
                : 'We can generate your invitation letter — fill the form to download.'}
            </p>
          </div>
          <a
            href="#visa-support"
            className="shrink-0 inline-flex items-center justify-center rounded-lg bg-[#8A5A0B] hover:bg-[#6E4506] text-white text-sm font-semibold px-4 py-2.5 transition-colors"
          >
            {p.lang === 'zh' ? '開始填寫 →' : 'Start now →'}
          </a>
        </div>
      </section>
    );
  }

  if (variant === 'live') {
    const day = (p.daysSinceFestivalStart ?? 0) + 1;
    return (
      <section
        aria-label={p.lang === 'zh' ? '活動進行中' : 'Festival live'}
        className="relative overflow-hidden rounded-2xl bg-[#0E0E10] pl-5 pr-4 sm:pl-6 sm:pr-5 py-4 sm:py-5"
      >
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-[#D4A84B]" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#D4A84B]">
              {p.lang === 'zh' ? '節慶進行中' : 'Festival is live'}
            </p>
            <p className="mt-1 text-[16px] sm:text-[17px] font-semibold text-[#F4F1E8] leading-snug">
              {p.lang === 'zh' ? `第 ${day} 天 · TDF 2026 共 31 天` : `Day ${day} of 31 · TDF 2026`}
            </p>
            {p.firstUpcomingEventName ? (
              <p className="mt-0.5 text-[12px] text-[#B8B0A0]">
                {p.lang === 'zh' ? '下一場：' : 'Next up: '}
                {p.firstUpcomingEventName}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const days = p.daysUntilFestival ?? 0;
  return (
    <section
      aria-label={p.lang === 'zh' ? '開幕倒數' : 'Festival countdown'}
      className="relative overflow-hidden rounded-2xl bg-[#0E0E10] pl-5 pr-4 sm:pl-6 sm:pr-5 py-5 sm:py-6"
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-[#D4A84B]" />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#D4A84B]">
            {p.lang === 'zh' ? '台東見' : 'See you in Taitung'}
          </p>
          <p className="mt-1.5 text-[17px] sm:text-[19px] font-semibold text-[#F4F1E8] leading-snug">
            {p.lang === 'zh' ? (
              <>
                還有{' '}
                <span className="font-display text-[#D4A84B] text-[24px] sm:text-[28px] font-bold align-baseline">
                  {days}
                </span>{' '}
                天就開幕
              </>
            ) : (
              <>
                <span className="font-display text-[#D4A84B] text-[24px] sm:text-[28px] font-bold align-baseline">
                  {days}
                </span>{' '}
                days until you land
              </>
            )}
          </p>
          {p.firstUpcomingEventName ? (
            <p className="mt-0.5 text-[12px] text-[#B8B0A0]">
              {p.lang === 'zh' ? '第一站：' : 'First stop: '}
              {p.firstUpcomingEventName}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
