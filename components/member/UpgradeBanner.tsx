'use client';

import Link from 'next/link';
import {
  TIER_NAMES,
  TIER_PERKS,
  TIER_ACCENT,
  TIER_RANK,
  TIER_ORDER,
  type IdentityTier,
} from './MemberPassport';

interface Props {
  currentTier: IdentityTier;
  lang: 'en' | 'zh';
}

export default function UpgradeBanner({ currentTier, lang }: Props) {
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
  const topPerk = TIER_PERKS[nextTier][lang][0];

  return (
    <Link
      href="/?lang=zh#tickets"
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
      <div className="relative flex items-center gap-4 px-6 py-5 sm:px-7 sm:py-6">
        {/* Left chevron stack */}
        <div className="shrink-0 flex items-center gap-[2px]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-[3px] h-6 rounded-sm"
              style={{
                backgroundColor: accent,
                opacity: 0.3 + i * 0.25,
                transform: `skewX(-12deg)`,
              }}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase" style={{ color: accent }}>
            {lang === 'zh' ? '升級到' : 'Upgrade to'}
          </p>
          <p className="font-display font-black uppercase tracking-tight text-2xl leading-tight">
            {tierName}
          </p>
          <p className="text-[12px] text-white/60 truncate mt-0.5">
            {lang === 'zh' ? '解鎖' : 'Unlock'} · {topPerk}
          </p>
        </div>

        <span
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-transform group-hover:translate-x-1"
          style={{ backgroundColor: accent, color: '#0F0F0F' }}
        >
          →
        </span>
      </div>
    </Link>
  );
}
