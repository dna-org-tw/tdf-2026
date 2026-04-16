'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import type { TicketTier } from '@/lib/members';

export type IdentityTier = 'follower' | TicketTier;

export interface MemberProfile {
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  timezone: string | null;
  tags: string[];
  languages: string[];
  socialLinks: Record<string, string>;
  isPublic: boolean;
}

interface PassportProps {
  email: string;
  memberNo: string | null;
  firstSeenAt?: string | null;
  tier: IdentityTier;
  validFrom?: string | null;
  validUntil?: string | null;
  profile?: MemberProfile;
  lang: 'en' | 'zh';
  editable?: boolean;
  onEdit?: () => void;
  onProfileChange?: (profile: MemberProfile) => void;
}

export const TIER_ORDER: IdentityTier[] = ['follower', 'explore', 'contribute', 'weekly_backer', 'backer'];

export const TIER_RANK: Record<IdentityTier, number> = {
  follower: 0,
  explore: 1,
  contribute: 2,
  weekly_backer: 3,
  backer: 4,
};

export const TIER_NAMES: Record<IdentityTier, { en: string; zh: string; code: string; short: string }> = {
  follower: { en: 'Follower', zh: 'Follower', code: 'LV.00', short: 'FLW' },
  explore: { en: 'Explore', zh: 'Explore', code: 'LV.01', short: 'EXP' },
  contribute: { en: 'Contribute', zh: 'Contribute', code: 'LV.02', short: 'CTB' },
  weekly_backer: { en: 'Weekly Backer', zh: 'Weekly Backer', code: 'LV.03', short: 'WKB' },
  backer: { en: 'Backer', zh: 'Backer', code: 'LV.04', short: 'BKR' },
};

export const TIER_TAGLINES: Record<IdentityTier, { en: string; zh: string }> = {
  follower: { en: 'On the waitlist · the tribe awaits', zh: '在名單上・部落等你加入' },
  explore: { en: 'One-day expedition · welcome', zh: '單日探索・歡迎來到部落' },
  contribute: { en: 'Co-creator of the festival', zh: '共創節慶的一份子' },
  weekly_backer: { en: 'A full week of nomadic life', zh: '與我們共度七日遊牧' },
  backer: { en: 'Honorary nomad · full clearance', zh: '榮譽遊牧・完整通行' },
};

export const TIER_PERKS: Record<IdentityTier, { en: string[]; zh: string[] }> = {
  follower: {
    en: ['Monthly newsletter', 'Community updates', 'Public side events'],
    zh: ['月度電子報', '社群最新動態', '公開周邊活動'],
  },
  explore: {
    en: ['1-day main stage access', 'Community board signature', 'Welcome sticker pack'],
    zh: ['主舞台單日通行', '社群夥伴牆署名', '入場貼紙包'],
  },
  contribute: {
    en: ['Multi-day festival pass', 'Contributor wall credit', 'Theme night after-party'],
    zh: ['多日通行證', '貢獻者牆刻名', '主題夜派對'],
  },
  weekly_backer: {
    en: ['7-day all-access pass', 'All workshops & sessions', 'Lodging partner discounts'],
    zh: ['7 日全區通行', '全工作坊與場次', '住宿夥伴折扣'],
  },
  backer: {
    en: ['Full-month access', 'Private founders dinner', 'VIP lounge · named thanks'],
    zh: ['整月完整通行', '創辦人私宴', 'VIP 休息室・署名致謝'],
  },
};

export const TIER_ACCENT: Record<IdentityTier, string> = {
  follower: '#F9D2E5',
  explore: '#10B8D9',
  contribute: '#52D472',
  weekly_backer: '#FFD028',
  backer: '#FFD028',
};

const TIER_SURFACE: Record<IdentityTier, string> = {
  follower: '#1A1815',
  explore: '#0A1929',
  contribute: '#06180F',
  weekly_backer: '#190900',
  backer: '#000000',
};

const TIER_GLOW: Record<IdentityTier, string> = {
  follower: 'radial-gradient(ellipse at 100% 0%,rgba(249,210,229,0.18),transparent 60%)',
  explore: 'radial-gradient(ellipse at 100% 0%,rgba(16,184,217,0.32),transparent 55%),radial-gradient(ellipse at 0% 100%,rgba(0,78,157,0.35),transparent 55%)',
  contribute: 'radial-gradient(ellipse at 100% 0%,rgba(0,153,62,0.32),transparent 55%),radial-gradient(ellipse at 0% 100%,rgba(82,212,114,0.18),transparent 55%)',
  weekly_backer: 'radial-gradient(ellipse at 100% 0%,rgba(255,208,40,0.35),transparent 55%),radial-gradient(ellipse at 0% 100%,rgba(231,67,16,0.32),transparent 55%)',
  backer: 'radial-gradient(ellipse at 50% 0%,rgba(255,208,40,0.4),transparent 55%),radial-gradient(ellipse at 100% 100%,rgba(197,64,144,0.35),transparent 55%)',
};

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.trim().slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
}

function MemberAvatar({ name, email, accent, avatarUrl, size = 48 }: { name: string | null; email: string; accent: string; avatarUrl?: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(name, email);

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name || email || 'Avatar'}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: `${accent}25`,
        color: accent,
        fontSize: size * 0.38,
        letterSpacing: '0.05em',
      }}
      aria-label={name || email}
    >
      {initials}
    </div>
  );
}

function formatIssueDate(iso: string | null, lang: 'en' | 'zh'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return lang === 'zh'
    ? `${d.getFullYear()}·${String(d.getMonth() + 1).padStart(2, '0')}·${String(d.getDate()).padStart(2, '0')}`
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

function ClearanceStars({ rank, accent }: { rank: number; accent: string }) {
  return (
    <div className="flex items-center gap-[2px]" aria-label={`clearance ${rank} of 4`}>
      {[0, 1, 2, 3].map((i) => {
        const filled = i < rank;
        return (
          <svg key={i} viewBox="0 0 24 24" className="w-3 h-3" aria-hidden>
            <path
              d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.5l7.1-.6L12 2z"
              fill={filled ? accent : 'transparent'}
              stroke={filled ? accent : 'rgba(255,255,255,0.3)'}
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </div>
  );
}

function formatValidityDate(dateStr: string, lang: 'en' | 'zh'): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return lang === 'zh'
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ValidityBadge({ validFrom, validUntil, lang }: { validFrom: string; validUntil: string; lang: 'en' | 'zh' }) {
  const today = new Date().toISOString().slice(0, 10);
  const isActive = today >= validFrom && today <= validUntil;
  const isExpired = today > validUntil;
  const isUpcoming = today < validFrom;

  const from = formatValidityDate(validFrom, lang);
  const until = formatValidityDate(validUntil, lang);

  let statusLabel: string;
  let statusColor: string;

  if (isActive) {
    statusLabel = lang === 'zh' ? 'ACTIVE' : 'ACTIVE';
    statusColor = '#52D472';
  } else if (isExpired) {
    statusLabel = lang === 'zh' ? 'EXPIRED' : 'EXPIRED';
    statusColor = '#EF4444';
  } else {
    statusLabel = lang === 'zh' ? 'UPCOMING' : 'UPCOMING';
    statusColor = '#FFD028';
  }

  return (
    <div className="flex items-center gap-2 text-[11px] font-mono">
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-bold tracking-[0.1em]"
        style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: statusColor }}
          aria-hidden
        />
        {statusLabel}
      </span>
      <span className="text-white/50">
        {from} → {until}
      </span>
      {isUpcoming && (
        <span className="text-white/35">
          ({lang === 'zh' ? '即將開始' : 'starts soon'})
        </span>
      )}
    </div>
  );
}

export default function MemberPassport({ email, memberNo, tier, validFrom, validUntil, profile, lang, editable, onEdit, onProfileChange }: PassportProps) {
  const accent = TIER_ACCENT[tier];
  const rank = TIER_RANK[tier];
  const surface = TIER_SURFACE[tier];
  const glow = TIER_GLOW[tier];

  const [showPerks, setShowPerks] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const publicUrl = useMemo(() => {
    if (!memberNo) return null;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/members/${memberNo}`;
    }
    return `/members/${memberNo}`;
  }, [memberNo]);

  const labels = {
    title: lang === 'zh' ? '後台通行證' : 'Backstage Credential',
    holder: lang === 'zh' ? '持有人' : 'Holder',
    no: lang === 'zh' ? '編號' : 'No.',
    since: lang === 'zh' ? '加入於' : 'Since',
    perks: lang === 'zh' ? '展開權益' : 'View privileges',
    hidePerks: lang === 'zh' ? '收合權益' : 'Hide privileges',
    privileges: lang === 'zh' ? '權益' : 'Privileges',
    showQr: lang === 'zh' ? '名片 QR Code' : 'Card QR Code',
    hideQr: lang === 'zh' ? '隱藏 QR Code' : 'Hide QR Code',
  };

  const tierName = TIER_NAMES[tier][lang] || TIER_NAMES[tier].en;
  const tagline = TIER_TAGLINES[tier][lang];
  const perks = TIER_PERKS[tier][lang];

  const isFoil = tier === 'backer';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
      className="relative w-full"
    >
      <div
        className="relative overflow-hidden rounded-2xl text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,0.45)]"
        style={{ backgroundColor: surface }}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ backgroundColor: accent }} />

        {/* Glow + grain */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: glow }} />
        <div
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.06]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }}
          aria-hidden
        />

        <div className="relative px-5 py-6 sm:px-8 sm:py-8">
          {/* Top row: member no + stars */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/40">
              {memberNo ?? 'M-———'} · TDF 2026
            </p>
            <ClearanceStars rank={rank} accent={accent} />
          </div>

          {/* Hero tier name */}
          <h2
            className="break-words"
            style={{
              fontFamily: 'var(--font-display), var(--font-noto-sans-tc), system-ui, sans-serif',
              fontWeight: 900,
              fontStyle: isFoil ? 'italic' : 'normal',
              fontSize: 'clamp(44px, 11vw, 76px)',
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
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

          {/* Profile: avatar + name + bio */}
          <div className="mt-5 flex items-start gap-4">
            <MemberAvatar name={profile?.displayName ?? null} email={email} accent={accent} avatarUrl={profile?.avatarUrl} size={52} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white truncate">
                {profile?.displayName || email.split('@')[0]}
              </p>
              {profile?.location && (
                <p className="text-[12px] text-white/50 mt-0.5 truncate">{profile.location}</p>
              )}
              {profile?.bio && (
                <p className="text-[13px] text-white/60 mt-1 line-clamp-2">{profile.bio}</p>
              )}
              {profile && profile.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.tags.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ backgroundColor: `${accent}20`, color: accent }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {editable && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="shrink-0 p-2 rounded-lg transition-colors hover:bg-white/10"
                aria-label="Edit profile"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/50">
                  <path
                    d="M16.474 5.408l2.118 2.118m-.756-3.982L12.109 9.27a2.118 2.118 0 0 0-.58 1.082L11 13l2.648-.53a2.118 2.118 0 0 0 1.082-.58l5.727-5.727a1.853 1.853 0 1 0-2.621-2.621z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Social links */}
          {profile && Object.keys(profile.socialLinks).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {Object.entries(profile.socialLinks).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-mono text-white/40 hover:text-white/70 transition-colors"
                >
                  {platform}
                </a>
              ))}
            </div>
          )}

          {/* Validity period — primary secondary info */}
          {tier !== 'follower' && validFrom && validUntil ? (
            <div className="mt-4">
              <ValidityBadge validFrom={validFrom} validUntil={validUntil} lang={lang} />
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-white/50 italic">{tagline}</p>
          )}

          {/* Perks toggle */}
          <button
            type="button"
            onClick={() => setShowPerks((v) => !v)}
            className="mt-6 w-full flex items-center justify-between gap-2 py-3 px-4 rounded-lg border text-[12px] font-mono tracking-[0.15em] uppercase transition-colors"
            style={{
              borderColor: `${accent}40`,
              color: accent,
              backgroundColor: showPerks ? `${accent}10` : 'transparent',
            }}
          >
            <span>
              {showPerks ? labels.hidePerks : labels.perks} · {perks.length}
            </span>
            <motion.span
              animate={{ rotate: showPerks ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              aria-hidden
            >
              ▾
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {showPerks && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden mt-3 space-y-2"
              >
                {perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-[13px] text-white/85">
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
                    <span>{perk}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>

          {/* QR Code */}
          {publicUrl && profile?.isPublic && (
            <>
              <button
                type="button"
                onClick={() => setShowQr((v) => !v)}
                className="mt-3 w-full flex items-center justify-between gap-2 py-2.5 px-4 rounded-lg border text-[12px] font-mono tracking-[0.15em] uppercase transition-colors"
                style={{
                  borderColor: `${accent}25`,
                  color: `${accent}90`,
                  backgroundColor: showQr ? `${accent}08` : 'transparent',
                }}
              >
                <span>{showQr ? labels.hideQr : labels.showQr}</span>
                <motion.span
                  animate={{ rotate: showQr ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  aria-hidden
                >
                  ▾
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {showQr && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden mt-3 flex flex-col items-center gap-3"
                  >
                    <div className="bg-white p-3 rounded-xl">
                      <QRCodeSVG
                        value={publicUrl}
                        size={160}
                        level="M"
                        bgColor="#FFFFFF"
                        fgColor={surface}
                      />
                    </div>
                    <p className="text-[11px] text-white/40 font-mono text-center break-all">
                      {publicUrl}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
