'use client';

import { motion } from 'framer-motion';
import type { TicketTier } from '@/lib/members';
import { TIER_NAMES, TIER_ACCENT } from '@/components/member/MemberPassport';

interface TierCardProps {
  tier: TicketTier;
  headline: string;
  pitch: string;
  highlights: string[];
  priceDiff: number;
  lang: 'en' | 'zh';
  upgradeLabel: string;
  priceDiffLabel: string;
  ctaLabel: string;
  processing: boolean;
  onUpgrade: () => void;
}

export default function TierCard({
  tier,
  headline,
  pitch,
  highlights,
  priceDiff,
  lang,
  upgradeLabel,
  priceDiffLabel,
  ctaLabel,
  processing,
  onUpgrade,
}: TierCardProps) {
  const accent = TIER_ACCENT[tier];
  const tierName = TIER_NAMES[tier]?.[lang] ?? TIER_NAMES[tier]?.en ?? tier;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative rounded-2xl overflow-hidden text-white"
      style={{ backgroundColor: '#0F0F0F' }}
    >
      <div
        className="absolute inset-0 opacity-90 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 100% 0%, ${accent}30, transparent 60%)`,
        }}
        aria-hidden
      />
      <div className="relative px-6 py-6 sm:px-8 sm:py-8">
        <p className="text-[10px] font-mono tracking-[0.3em] uppercase mb-1" style={{ color: accent }}>
          {upgradeLabel}
        </p>
        <h3 className="font-display font-black uppercase tracking-tight text-2xl sm:text-3xl leading-tight mb-2">
          {tierName}
        </h3>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-[11px] text-white/50 uppercase tracking-wider">{priceDiffLabel}</span>
          <span className="font-display font-bold text-xl" style={{ color: accent }}>+${priceDiff}</span>
          <span className="text-[11px] text-white/40">USD</span>
        </div>
        <p className="text-sm text-white/70 leading-relaxed mb-4">{pitch}</p>
        <h4 className="text-xs font-mono tracking-[0.2em] uppercase text-white/50 mb-3">{headline}</h4>
        <ul className="space-y-2 mb-6">
          {highlights.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[13px] text-white/80">
              <svg viewBox="0 0 24 24" className="w-4 h-4 mt-[2px] shrink-0" aria-hidden>
                <path d="M5 12.5l4 4 10-11" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={onUpgrade}
          disabled={processing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[13px] font-mono tracking-[0.15em] uppercase font-semibold transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: accent, color: '#0F0F0F' }}
        >
          <span>{ctaLabel}</span>
          {!processing && <span>→</span>}
          {processing && <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />}
        </button>
      </div>
    </motion.div>
  );
}
