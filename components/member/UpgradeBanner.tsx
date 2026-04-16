'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { getPricingByKey, isOnSale } from '@/lib/ticketPricing';
import type { TicketTier } from '@/lib/members';
import {
  TIER_NAMES,
  TIER_ACCENT,
  TIER_RANK,
  TIER_ORDER,
  type IdentityTier,
} from './MemberPassport';

interface Props {
  currentTier: IdentityTier;
  lang: 'en' | 'zh';
}

function getTicketFeatures(t: ReturnType<typeof useTranslation>['t'], tier: string): string[] {
  const section = t.tickets as Record<string, { features?: string[] }>;
  return section[tier]?.features ?? [];
}

export default function UpgradeBanner({ currentTier, lang }: Props) {
  const { t } = useTranslation();
  const currentRank = TIER_RANK[currentTier];
  const nextTier = TIER_ORDER.find((t) => TIER_RANK[t] === currentRank + 1) ?? null;

  if (!nextTier) {
    return (
      <div
        className="rounded-2xl px-5 py-4 border"
        style={{
          background: 'linear-gradient(90deg,rgba(255,208,40,0.18),#ffffff,rgba(197,64,144,0.15))',
          borderColor: 'rgba(255,208,40,0.4)',
        }}
      >
        <p className="text-[10px] font-mono tracking-[0.3em] uppercase" style={{ color: 'rgba(30,31,28,0.6)' }}>
          {lang === 'zh' ? '你已站在頂端' : 'At the summit'}
        </p>
        <p className="font-display font-bold mt-1" style={{ color: '#1E1F1C' }}>
          {lang === 'zh' ? '謝謝你成為 2026 年的榮譽遊牧' : 'Thank you, honorary nomad of TDF 2026'}
        </p>
      </div>
    );
  }

  const accent = TIER_ACCENT[nextTier];
  const tierName = TIER_NAMES[nextTier][lang] || TIER_NAMES[nextTier].en;
  const pricing = getPricingByKey(nextTier as TicketTier);
  const onSale = isOnSale();

  // Differential features: what the next tier has that current doesn't
  const currentFeatures = currentTier === 'follower'
    ? getTicketFeatures(t, 'follower')
    : getTicketFeatures(t, currentTier);
  const nextFeatures = getTicketFeatures(t, nextTier);
  const currentSet = new Set(currentFeatures);
  const diffFeatures = nextFeatures.filter((f) => !currentSet.has(f));
  const displayFeatures = diffFeatures.length > 0 ? diffFeatures.slice(0, 3) : nextFeatures.slice(0, 3);

  const price = pricing ? (onSale ? pricing.salePrice : pricing.originalPrice) : null;
  const originalPrice = pricing?.originalPrice ?? null;
  const hasDiscount = onSale && pricing && pricing.salePrice < pricing.originalPrice;

  return (
    <Link
      href={`/upgrade?lang=${lang}`}
      className="group relative block rounded-2xl overflow-hidden text-white"
      style={{ backgroundColor: '#0F0F0F' }}
    >
      <div
        className="absolute inset-0 opacity-90 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 100% 50%, ${accent}28, transparent 55%)`,
        }}
        aria-hidden
      />
      <div className="relative px-5 py-5 sm:px-7 sm:py-6">
        {/* Top row: label + chevrons */}
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase" style={{ color: accent }}>
            {lang === 'zh' ? '升級到' : 'Upgrade to'}
          </p>
          <div className="flex items-center gap-[2px]">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block w-[3px] h-5 rounded-sm"
                style={{
                  backgroundColor: accent,
                  opacity: 0.3 + i * 0.25,
                  transform: 'skewX(-12deg)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Tier name + price row */}
        <div className="flex items-end justify-between gap-3">
          <h3 className="font-display font-black uppercase tracking-tight text-2xl leading-tight">
            {tierName}
          </h3>
          {price != null && (
            <div className="text-right shrink-0">
              {hasDiscount && (
                <span className="text-[12px] text-white/40 line-through mr-1.5">
                  ${originalPrice}
                </span>
              )}
              <span className="font-display font-bold text-xl" style={{ color: accent }}>
                ${price}
              </span>
              <span className="text-[11px] text-white/50 ml-1">USD</span>
            </div>
          )}
        </div>

        {/* Differential features */}
        {displayFeatures.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {displayFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2 text-[13px] text-white/75">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 mt-[3px] shrink-0" aria-hidden>
                  <path
                    d="M5 12.5l4 4 10-11"
                    fill="none"
                    stroke={accent}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        )}

        {/* CTA */}
        <div
          className="mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[12px] font-mono tracking-[0.15em] uppercase font-semibold transition-colors group-hover:brightness-110"
          style={{ backgroundColor: accent, color: '#0F0F0F' }}
        >
          <span>{lang === 'zh' ? '立即升級' : 'Upgrade now'}</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Link>
  );
}
