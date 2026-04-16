'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  TIER_ACCENT,
  TIER_NAMES,
  TIER_RANK,
  TIER_TAGLINES,
  type IdentityTier,
} from '@/components/member/MemberPassport';

/* ------------------------------------------------------------------ */
/*  Types – matches the shape returned by GET /api/member/[memberNo]/card */
/* ------------------------------------------------------------------ */

interface CardData {
  memberNo: string;
  tier: IdentityTier;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  tags: string[];
  languages: string[];
  socialLinks: { type: string; url: string }[];
  validFrom: string | null;
  validUntil: string | null;
}

/* ------------------------------------------------------------------ */
/*  Visual constants (mirrored from MemberPassport)                    */
/* ------------------------------------------------------------------ */

const TIER_SURFACE: Record<IdentityTier, string> = {
  follower: '#1A1815',
  explore: '#0A1929',
  contribute: '#06180F',
  weekly_backer: '#190900',
  backer: '#000000',
};

const TIER_GLOW: Record<IdentityTier, string> = {
  follower: 'radial-gradient(ellipse at 100% 0%,rgba(249,210,229,0.18),transparent 60%)',
  explore:
    'radial-gradient(ellipse at 100% 0%,rgba(16,184,217,0.32),transparent 55%),radial-gradient(ellipse at 0% 100%,rgba(0,78,157,0.35),transparent 55%)',
  contribute:
    'radial-gradient(ellipse at 100% 0%,rgba(0,153,62,0.32),transparent 55%),radial-gradient(ellipse at 0% 100%,rgba(82,212,114,0.18),transparent 55%)',
  weekly_backer:
    'radial-gradient(ellipse at 100% 0%,rgba(255,208,40,0.35),transparent 55%),radial-gradient(ellipse at 0% 100%,rgba(231,67,16,0.32),transparent 55%)',
  backer:
    'radial-gradient(ellipse at 50% 0%,rgba(255,208,40,0.4),transparent 55%),radial-gradient(ellipse at 100% 100%,rgba(197,64,144,0.35),transparent 55%)',
};

const SOCIAL_ICONS: Record<string, string> = {
  twitter: 'M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.63 7.58H.48l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41z',
  instagram:
    'M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.69-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.36-2.62-6.78-6.98-6.98C16.67.01 16.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zM12 16a4 4 0 110-8 4 4 0 010 8zm6.41-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z',
  linkedin:
    'M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z',
  github:
    'M12 .3a12 12 0 00-3.79 23.4c.6.1.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016.02 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18a4.65 4.65 0 011.24 3.22c0 4.61-2.81 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0012 .3',
  website:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
};

/* ------------------------------------------------------------------ */
/*  Helper: initials from display name                                 */
/* ------------------------------------------------------------------ */

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Helper: format validity dates                                      */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Clearance stars (reused from MemberPassport style)                 */
/* ------------------------------------------------------------------ */

function ClearanceStars({ rank, accent }: { rank: number; accent: string }) {
  return (
    <div className="flex items-center gap-[2px]" aria-label={`clearance ${rank} of 4`}>
      {[0, 1, 2, 3].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className="w-3 h-3" aria-hidden>
          <path
            d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.5l7.1-.6L12 2z"
            fill={i < rank ? accent : 'transparent'}
            stroke={i < rank ? accent : 'rgba(255,255,255,0.3)'}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Social icon component                                              */
/* ------------------------------------------------------------------ */

function SocialIcon({ type, url, accent }: { type: string; url: string; accent: string }) {
  const path = SOCIAL_ICONS[type] || SOCIAL_ICONS.website;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
      style={{ backgroundColor: `${accent}15` }}
      aria-label={type}
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={accent}>
        <path d={path} />
      </svg>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export default function PublicMemberCardPage() {
  const params = useParams();
  const memberNo = params.memberNo as string;

  const [data, setData] = useState<CardData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'private' | 'error'>('loading');

  useEffect(() => {
    if (!memberNo) return;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    fetch(`${baseUrl}/api/member/${encodeURIComponent(memberNo)}/card`)
      .then((res) => {
        if (res.status === 404) {
          setStatus('private');
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json) {
          setData(json);
          setStatus('ok');
        }
      })
      .catch(() => setStatus('error'));
  }, [memberNo]);

  /* ----- Loading state ----- */
  if (status === 'loading') {
    return (
      <div className="min-h-dvh bg-[#0C0A09] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          <p className="text-[12px] font-mono tracking-[0.15em] text-white/40 uppercase">
            Loading card...
          </p>
        </div>
      </div>
    );
  }

  /* ----- Private / not found ----- */
  if (status === 'private') {
    return (
      <div className="min-h-dvh bg-[#0C0A09] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="text-[15px] text-white/60 mb-1">This card is private</p>
          <p className="text-[12px] text-white/30 font-mono tracking-wide">
            {memberNo}
          </p>
          <a
            href="/"
            className="inline-block mt-8 text-[11px] font-mono tracking-[0.15em] uppercase text-white/30 hover:text-white/50 transition-colors"
          >
            TDF 2026
          </a>
        </div>
      </div>
    );
  }

  /* ----- Error state ----- */
  if (status === 'error' || !data) {
    return (
      <div className="min-h-dvh bg-[#0C0A09] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-[15px] text-white/60 mb-1">Something went wrong</p>
          <p className="text-[12px] text-white/30 font-mono tracking-wide">
            Could not load the member card. Please try again later.
          </p>
          <a
            href="/"
            className="inline-block mt-8 text-[11px] font-mono tracking-[0.15em] uppercase text-white/30 hover:text-white/50 transition-colors"
          >
            TDF 2026
          </a>
        </div>
      </div>
    );
  }

  /* ----- Render card ----- */
  const tier = data.tier;
  const accent = TIER_ACCENT[tier];
  const rank = TIER_RANK[tier];
  const surface = TIER_SURFACE[tier];
  const glow = TIER_GLOW[tier];
  const tierName = TIER_NAMES[tier]?.en ?? tier;
  const tagline = TIER_TAGLINES[tier]?.en ?? '';
  const isFoil = tier === 'backer';
  const initials = getInitials(data.displayName);

  return (
    <div className="min-h-dvh bg-[#0C0A09] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
        className="w-full max-w-md"
      >
        {/* --- Card --- */}
        <div
          className="relative overflow-hidden rounded-2xl text-white shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]"
          style={{ backgroundColor: surface }}
        >
          {/* Top accent bar */}
          <div className="h-1 w-full" style={{ backgroundColor: accent }} />

          {/* Glow overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: glow }} />

          {/* Grain texture */}
          <div
            className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.06]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
            }}
            aria-hidden
          />

          <div className="relative px-6 py-7 sm:px-8 sm:py-9">
            {/* Header row: member no + stars */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/40">
                {data.memberNo} · TDF 2026
              </p>
              <ClearanceStars rank={rank} accent={accent} />
            </div>

            {/* Avatar + name block */}
            <div className="flex items-start gap-4 mb-5">
              {/* Avatar circle */}
              <div
                className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-bold tracking-tight"
                style={{
                  backgroundColor: `${accent}18`,
                  color: accent,
                  border: `1.5px solid ${accent}40`,
                }}
              >
                {data.avatarUrl ? (
                  <img
                    src={data.avatarUrl}
                    alt={data.displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="text-[20px] font-bold text-white leading-tight truncate">
                  {data.displayName}
                </h1>
                <p className="text-[12px] font-mono tracking-[0.1em] text-white/40 mt-0.5">
                  {tierName} · {TIER_NAMES[tier]?.code}
                </p>
              </div>
            </div>

            {/* Bio */}
            {data.bio && (
              <p className="text-[13px] text-white/65 leading-relaxed mb-5">
                {data.bio}
              </p>
            )}

            {/* Location */}
            {data.location && (
              <div className="flex items-center gap-2 mb-4">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white/35 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="text-[12px] text-white/50 font-mono tracking-wide">
                  {data.location}
                </span>
              </div>
            )}

            {/* Languages */}
            {data.languages.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white/35 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                </svg>
                <div className="flex flex-wrap gap-1.5">
                  {data.languages.map((lang) => (
                    <span
                      key={lang}
                      className="text-[11px] font-mono tracking-wide px-2 py-0.5 rounded-sm"
                      style={{ backgroundColor: `${accent}12`, color: `${accent}CC` }}
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {data.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {data.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] font-mono tracking-wide px-2.5 py-1 rounded-md border"
                    style={{
                      borderColor: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.55)',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Social links */}
            {data.socialLinks.length > 0 && (
              <div className="flex items-center gap-2 mb-5">
                {data.socialLinks.map((link) => (
                  <SocialIcon key={link.url} type={link.type} url={link.url} accent={accent} />
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="h-px w-full mb-5" style={{ backgroundColor: `${accent}20` }} />

            {/* Tier display */}
            <h2
              className="break-words"
              style={{
                fontFamily: 'var(--font-outfit), var(--font-noto-sans-tc), system-ui, sans-serif',
                fontWeight: 900,
                fontStyle: isFoil ? 'italic' : 'normal',
                fontSize: 'clamp(36px, 9vw, 56px)',
                lineHeight: 0.9,
                letterSpacing: '-0.02em',
                textTransform: 'uppercase' as const,
                ...(isFoil
                  ? {
                      backgroundImage:
                        'linear-gradient(96deg,#FFD028 0%,#FFFFFF 38%,#C54090 70%,#FFD028 100%)',
                      backgroundSize: '200% 100%',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                    }
                  : { color: '#fff' }),
              }}
            >
              {tierName}
            </h2>

            {/* Tagline or validity */}
            {tier !== 'follower' && data.validFrom && data.validUntil ? (
              <p className="mt-3 text-[12px] font-mono text-white/45">
                {formatDate(data.validFrom)} &rarr; {formatDate(data.validUntil)}
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-white/45 italic">{tagline}</p>
            )}
          </div>
        </div>

        {/* --- Branding footer --- */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="inline-block text-[10px] font-mono tracking-[0.25em] uppercase text-white/20 hover:text-white/40 transition-colors"
          >
            Taiwan Digital Fest 2026
          </a>
        </div>
      </motion.div>
    </div>
  );
}
