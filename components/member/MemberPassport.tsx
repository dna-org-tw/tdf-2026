'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { MapPin, Briefcase, Hourglass, Tag, Link2, Bookmark, FileText, Pencil } from 'lucide-react';
import type { TicketTier } from '@/lib/members';
import CardShareModal from './CardShareModal';

export type IdentityTier = 'follower' | TicketTier;

export type WorkType =
  | 'admin_mgmt'
  | 'sales_marketing'
  | 'finance_legal'
  | 'it_engineering'
  | 'design_creative'
  | 'education_research'
  | 'healthcare_social'
  | 'tourism_hospitality'
  | 'manufacturing_logistics'
  | 'freelance_entrepreneur';

export type NomadExperience =
  | 'not_yet'
  | 'under_3m'
  | '3m_to_1y'
  | '1_to_3y'
  | '3_to_5y'
  | '5_to_10y'
  | 'over_10y';

const WORK_TYPE_LABELS: Record<WorkType, { en: string; zh: string }> = {
  admin_mgmt: { en: 'Administration / Management', zh: '行政 / 管理' },
  sales_marketing: { en: 'Sales / Marketing', zh: '銷售 / 市場行銷' },
  finance_legal: { en: 'Finance / Accounting / Legal', zh: '財務 / 會計 / 法務' },
  it_engineering: { en: 'IT / Engineering', zh: '資訊科技 / 工程' },
  design_creative: { en: 'Design / Creative / Media', zh: '設計 / 創意 / 媒體' },
  education_research: { en: 'Education / Training / Research', zh: '教育 / 培訓 / 研究' },
  healthcare_social: { en: 'Healthcare / Social Services', zh: '醫療 / 保健 / 社會服務' },
  tourism_hospitality: { en: 'Tourism / Hospitality', zh: '旅遊 / 酒店 / 服務業' },
  manufacturing_logistics: { en: 'Manufacturing / Logistics', zh: '製造 / 物流 / 供應鏈' },
  freelance_entrepreneur: { en: 'Freelancer / Entrepreneur', zh: '自由職業 / 創業' },
};

const NOMAD_EXPERIENCE_LABELS: Record<NomadExperience, { en: string; zh: string }> = {
  not_yet: { en: 'Not yet', zh: '尚未' },
  under_3m: { en: '< 3 months', zh: '< 3 個月' },
  '3m_to_1y': { en: '3 months – 1 year', zh: '3 個月 – 1 年' },
  '1_to_3y': { en: '1 – 3 years', zh: '1 – 3 年' },
  '3_to_5y': { en: '3 – 5 years', zh: '3 – 5 年' },
  '5_to_10y': { en: '5 – 10 years', zh: '5 – 10 年' },
  over_10y: { en: '> 10 years', zh: '> 10 年' },
};

// Compact labels for the chips that sit on the card face.
const WORK_TYPE_SHORT: Record<WorkType, { en: string; zh: string }> = {
  admin_mgmt: { en: 'Admin', zh: '行政' },
  sales_marketing: { en: 'Sales', zh: '銷售' },
  finance_legal: { en: 'Finance', zh: '財務' },
  it_engineering: { en: 'IT', zh: '科技' },
  design_creative: { en: 'Design', zh: '設計' },
  education_research: { en: 'Edu', zh: '教育' },
  healthcare_social: { en: 'Health', zh: '醫療' },
  tourism_hospitality: { en: 'Travel', zh: '旅遊' },
  manufacturing_logistics: { en: 'Logistics', zh: '製造' },
  freelance_entrepreneur: { en: 'Freelance', zh: '自由' },
};

const NOMAD_EXPERIENCE_SHORT: Record<NomadExperience, string> = {
  not_yet: '0',
  under_3m: '<3M',
  '3m_to_1y': '3M–1Y',
  '1_to_3y': '1–3Y',
  '3_to_5y': '3–5Y',
  '5_to_10y': '5–10Y',
  over_10y: '>10Y',
};

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
  nationality?: string | null;
  workTypes?: WorkType[] | null;
  nomadExperience?: NomadExperience | null;
}

interface QrLabels {
  qrHelper: string;
  qrExpiresIn: string;
  qrExpired: string;
  qrRegenerate: string;
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
  qrLabels?: QrLabels;
  collectionsLabel?: string;
  collectionsUnread?: number;
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

// Per-tier pattern overlay on the card face, escalating with rank.
const TIER_PATTERN: Record<IdentityTier, string | null> = {
  follower: null,
  explore:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><path d='M24 0H0v24' fill='none' stroke='%23ffffff' stroke-opacity='0.05' stroke-width='0.6'/></svg>\")",
  contribute:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><path d='M-1 15l16-16M13 15l16-16M-1 -1l16 16' fill='none' stroke='%2352D472' stroke-opacity='0.08' stroke-width='0.8'/></svg>\")",
  weekly_backer:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='8'><g stroke='%23FFD028' stroke-opacity='0.06' stroke-width='0.4'><path d='M0 1h120M0 3h120M0 5h120M0 7h120'/></g><g stroke='%23FFD028' stroke-opacity='0.12' stroke-width='0.35'><path d='M8 0v8M34 0v8M72 0v8M96 0v8'/></g></svg>\")",
  backer:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><g fill='none' stroke='%23FFD028' stroke-opacity='0.09' stroke-width='0.5'><path d='M30 0l30 17.32v17.32L30 52.5 0 34.64V17.32z'/><circle cx='30' cy='26' r='14'/></g></svg>\")",
};

const TIER_ACCENT_BAR: Record<IdentityTier, string> = {
  follower: '#F9D2E5',
  explore: '#10B8D9',
  contribute: 'linear-gradient(90deg,#52D472 0%,#10B8D9 100%)',
  weekly_backer: 'linear-gradient(90deg,#B8860B 0%,#FFD028 50%,#FFF3B0 100%)',
  backer: 'linear-gradient(90deg,#C54090 0%,#FFD028 35%,#FFFFFF 50%,#FFD028 65%,#C54090 100%)',
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

function AvatarHero({
  name,
  email,
  accent,
  avatarUrl,
  glow,
  surface,
  editable,
  lang,
  onChange,
}: {
  name: string | null;
  email: string;
  accent: string;
  avatarUrl?: string | null;
  glow: string;
  surface: string;
  editable?: boolean;
  lang: 'en' | 'zh';
  onChange?: (newUrl: string | null) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initials = getInitials(name, email);

  const handleFile = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError(lang === 'zh' ? '僅支援 JPEG / PNG / WebP' : 'Only JPEG / PNG / WebP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError(lang === 'zh' ? '檔案最大 2 MB' : 'File must be under 2 MB');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/member/avatar', { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setImgError(false);
      onChange?.(data.avatar_url);
    } catch {
      setUploadError(lang === 'zh' ? '上傳失敗' : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const showImage = avatarUrl && !imgError;

  return (
    <div className="absolute inset-0">
      {showImage ? (
        <img
          src={avatarUrl}
          alt={name || email || 'Avatar'}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: surface, background: glow }}
          aria-label={name || email}
        >
          <span
            className="font-black leading-none select-none"
            style={{
              color: accent,
              fontSize: 'clamp(48px, 45cqw, 130px)',
              letterSpacing: '-0.02em',
              opacity: 0.9,
            }}
          >
            {initials}
          </span>
        </div>
      )}

      {/* Grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.08]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
        aria-hidden
      />

      {editable && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity bg-black/55 text-white text-[11px] font-medium tracking-[0.15em] uppercase disabled:opacity-60"
            aria-label={lang === 'zh' ? '更換照片' : 'Change photo'}
          >
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 7h3l2-3h8l2 3h3v12H3zM12 10a4 4 0 100 8 4 4 0 000-8z" strokeLinejoin="round" />
              </svg>
              {uploading
                ? lang === 'zh' ? '上傳中…' : 'Uploading…'
                : lang === 'zh' ? '更換照片' : 'Change photo'}
            </span>
          </button>
          {uploadError && (
            <div className="absolute left-2 right-2 bottom-2 bg-red-500/90 text-white text-[10px] px-2 py-1 rounded">
              {uploadError}
            </div>
          )}
        </>
      )}
    </div>
  );
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


function MemberInfoChips({
  profile,
  accent,
  lang,
}: {
  profile?: MemberProfile;
  accent: string;
  lang: 'en' | 'zh';
}) {
  if (!profile) return null;
  const { nationality, workTypes, nomadExperience } = profile;
  const hasAny =
    !!nationality ||
    (workTypes && workTypes.length > 0) ||
    !!nomadExperience;
  if (!hasAny) return null;

  const work = (workTypes ?? []).slice(0, 3);
  const extraWork = (workTypes?.length ?? 0) - work.length;

  const chipBase: React.CSSProperties = {
    backgroundColor: `${accent}1f`,
    color: accent,
    boxShadow: `inset 0 0 0 1px ${accent}33`,
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 sm:gap-1.5">
      {nationality && (
        <span
          className="px-1.5 py-[2px] rounded text-[9px] sm:text-[10px] font-mono tracking-wider uppercase"
          style={chipBase}
        >
          {nationality}
        </span>
      )}
      {work.map((w) => (
        <span
          key={w}
          className="px-1.5 py-[2px] rounded text-[9px] sm:text-[10px] font-medium"
          style={chipBase}
        >
          {WORK_TYPE_SHORT[w]?.[lang] ?? w}
        </span>
      ))}
      {extraWork > 0 && (
        <span className="text-[9px] sm:text-[10px] text-white/45">
          +{extraWork}
        </span>
      )}
      {nomadExperience && (
        <span
          className="px-1.5 py-[2px] rounded text-[9px] sm:text-[10px] font-mono tracking-wider"
          style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.78)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
          }}
        >
          {NOMAD_EXPERIENCE_SHORT[nomadExperience]}
        </span>
      )}
    </div>
  );
}

function ValidityFoot({
  tier,
  rank,
  validFrom,
  validUntil,
  lang,
}: {
  tier: IdentityTier;
  rank: number;
  validFrom?: string | null;
  validUntil?: string | null;
  lang: 'en' | 'zh';
}) {
  const today = new Date().toISOString().slice(0, 10);
  const hasValidity = tier !== 'follower' && !!validFrom && !!validUntil;
  const isActive = hasValidity && today >= validFrom! && today <= validUntil!;
  const isExpired = hasValidity && today > validUntil!;
  const from = validFrom ? formatValidityDate(validFrom, lang) : '';
  const until = validUntil ? formatValidityDate(validUntil, lang) : '';

  const levelLabel = `LV.${rank.toString().padStart(2, '0')}`;
  const validityColor = isActive
    ? 'rgba(82,212,114,1)'
    : isExpired
      ? 'rgba(239,68,68,1)'
      : 'rgba(255,208,40,1)';

  return (
    <div className="min-w-0 flex-1">
      <p className="text-[9px] sm:text-[11px] font-mono tracking-[0.15em] uppercase text-white/55 truncate flex items-center gap-1.5">
        {hasValidity ? (
          <>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: validityColor }}
              aria-hidden
            />
            <span>VALID {from} → {until}</span>
          </>
        ) : (
          <span>{levelLabel}</span>
        )}
      </p>
    </div>
  );
}

function ChipQr({
  memberNo,
  accent,
  surface,
  onOpen,
  lang,
}: {
  memberNo: string;
  accent: string;
  surface: string;
  onOpen: () => void;
  lang: 'en' | 'zh';
}) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [loading, setLoading] = useState(true);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/member/qr-token', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setToken(data.token);
      setExpiresAt(data.expiresAt);
    } catch (err) {
      console.error('[ChipQr] fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchToken(); }, [fetchToken]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const msLeft = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0;
  const isExpired = msLeft === 0 && !!expiresAt;

  useEffect(() => {
    if (isExpired && !loading) fetchToken();
  }, [isExpired, loading, fetchToken]);

  const qrUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/members/${memberNo}?t=${token}`
    : '';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative shrink-0 rounded-md bg-white p-1 transition-transform hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-white/40"
      style={{
        width: 'clamp(36px, 11cqw, 52px)',
        height: 'clamp(36px, 11cqw, 52px)',
        boxShadow: `0 0 0 1px ${accent}66, 0 2px 8px rgba(0,0,0,0.45)`,
      }}
      aria-label={lang === 'zh' ? '展開名片 QR' : 'Show share QR'}
    >
      {qrUrl ? (
        <QRCodeSVG
          value={qrUrl}
          size={256}
          level="M"
          bgColor="#FFFFFF"
          fgColor={surface}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <div className="w-full h-full bg-neutral-100 animate-pulse rounded" />
      )}
      <span
        className="absolute -top-1 -right-1 rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: accent, color: surface }}
        aria-hidden
      >
        <svg viewBox="0 0 16 16" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 8h8M8 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}


export default function MemberPassport({
  email,
  memberNo,
  tier,
  validFrom,
  validUntil,
  profile,
  lang,
  editable,
  qrLabels,
  collectionsLabel,
  collectionsUnread = 0,
}: PassportProps) {
  const accent = TIER_ACCENT[tier];
  const rank = TIER_RANK[tier];
  const surface = TIER_SURFACE[tier];
  const glow = TIER_GLOW[tier];
  const pattern = TIER_PATTERN[tier];
  const accentBar = TIER_ACCENT_BAR[tier];
  const tierName = TIER_NAMES[tier][lang] || TIER_NAMES[tier].en;
  const levelCode = TIER_NAMES[tier].code;
  const [shareOpen, setShareOpen] = useState(false);

  const showInfoSection = !!profile;
  const openEditor = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-profile-editor'));
    }
  }, []);

  // Build the info rows that should appear in the body (skip empty ones)
  const infoRows: Array<{ key: string; icon: React.ReactNode; label: string; value: React.ReactNode }> = [];
  if (profile?.location) {
    infoRows.push({
      key: 'location',
      icon: <MapPin className="w-3.5 h-3.5" />,
      label: lang === 'zh' ? '所在地' : 'Location',
      value: <p className="text-[14px] text-white/85 leading-snug">{profile.location}</p>,
    });
  }
  if (profile?.workTypes && profile.workTypes.length > 0) {
    infoRows.push({
      key: 'work',
      icon: <Briefcase className="w-3.5 h-3.5" />,
      label: lang === 'zh' ? '工作型態' : 'Work',
      value: (
        <div className="flex flex-wrap gap-1.5">
          {profile.workTypes.map((w) => (
            <span
              key={w}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: `${accent}1f`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}33` }}
            >
              {WORK_TYPE_LABELS[w]?.[lang] ?? w}
            </span>
          ))}
        </div>
      ),
    });
  }
  if (profile?.nomadExperience) {
    infoRows.push({
      key: 'nomad',
      icon: <Hourglass className="w-3.5 h-3.5" />,
      label: lang === 'zh' ? '數位遊牧資歷' : 'Nomad experience',
      value: (
        <p className="text-[14px] text-white/85">
          {NOMAD_EXPERIENCE_LABELS[profile.nomadExperience]?.[lang] ?? profile.nomadExperience}
        </p>
      ),
    });
  }
  if (profile?.bio) {
    infoRows.push({
      key: 'bio',
      icon: <FileText className="w-3.5 h-3.5" />,
      label: lang === 'zh' ? '自我介紹' : 'Bio',
      value: <p className="text-[13.5px] text-white/85 leading-relaxed whitespace-pre-line">{profile.bio}</p>,
    });
  }
  if (profile?.tags && profile.tags.length > 0) {
    infoRows.push({
      key: 'tags',
      icon: <Tag className="w-3.5 h-3.5" />,
      label: lang === 'zh' ? '標籤' : 'Tags',
      value: (
        <div className="flex flex-wrap gap-1.5">
          {profile.tags.slice(0, 12).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: `${accent}1f`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}33` }}
            >
              {tag}
            </span>
          ))}
        </div>
      ),
    });
  }
  if (profile && Object.keys(profile.socialLinks).length > 0) {
    infoRows.push({
      key: 'social',
      icon: <Link2 className="w-3.5 h-3.5" />,
      label: lang === 'zh' ? '社群連結' : 'Social',
      value: (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(profile.socialLinks).map(([platform, url]) => (
            <a
              key={platform}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-mono text-white/75 hover:text-white underline-offset-2 hover:underline transition-colors"
            >
              {platform}
            </a>
          ))}
        </div>
      ),
    });
  }
  if (memberNo && collectionsLabel) {
    infoRows.push({
      key: 'collections',
      icon: <Bookmark className="w-3.5 h-3.5" />,
      label: lang === 'zh' ? '收藏' : 'Collections',
      value: (
        <Link
          href="/me/collections"
          className="inline-flex items-center gap-2 text-[14px] text-white/85 hover:text-white transition-colors"
        >
          <span>{collectionsLabel}</span>
          {collectionsUnread > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {collectionsUnread}
            </span>
          )}
          <span aria-hidden>→</span>
        </Link>
      ),
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
      className="relative w-full max-w-[26rem] mx-auto"
    >
      {/* Portrait passport card — single rounded container */}
      <div
        className="relative overflow-hidden rounded-2xl text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]"
        style={{ backgroundColor: surface, containerType: 'inline-size' }}
      >
        {/* Top accent bar */}
        <div
          className="absolute inset-x-0 top-0 h-1 z-30"
          style={{ background: accentBar }}
        />

        {/* ===== Hero (square, full-width avatar) ===== */}
        <div className="relative" style={{ aspectRatio: '1 / 1' }}>
          {/* Avatar fills the entire hero */}
          <AvatarHero
            name={profile?.displayName ?? null}
            email={email}
            accent={accent}
            avatarUrl={profile?.avatarUrl}
            glow={glow}
            surface={surface}
            editable={false}
            lang={lang}
          />

          {/* Pattern overlay (subtle) */}
          {pattern && (
            <div
              className="absolute inset-0 pointer-events-none opacity-50 mix-blend-overlay"
              style={{ backgroundImage: pattern }}
              aria-hidden
            />
          )}

          {/* Tier glow tint at the top */}
          <div
            className="absolute inset-x-0 top-0 pointer-events-none opacity-60"
            style={{ background: glow, height: '50%' }}
            aria-hidden
          />

          {/* Top dimming for header legibility */}
          <div
            className="absolute inset-x-0 top-0 h-24 pointer-events-none bg-gradient-to-b from-black/55 via-black/20 to-transparent z-10"
            aria-hidden
          />

          {/* Bottom dimming for identity legibility */}
          <div
            className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none bg-gradient-to-t from-black/90 via-black/55 to-transparent z-10"
            aria-hidden
          />

          {/* Top header overlay */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-start justify-between gap-3 p-4 pt-5">
            <div className="min-w-0">
              <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-white/85">
                TDF 2026
              </p>
              <p className="mt-0.5 text-[12px] font-mono tracking-[0.15em] text-white/95">
                {memberNo ?? 'M-———'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <ClearanceStars rank={rank} accent={accent} />
            </div>
          </div>

          {/* Edit button (top-right, sits below the stars row visually) */}
          {editable && (
            <button
              type="button"
              onClick={openEditor}
              className="absolute top-12 right-3 z-30 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-md text-white/90 hover:text-white text-[11px] font-medium transition-colors border border-white/15"
              aria-label={lang === 'zh' ? '編輯' : 'Edit'}
            >
              <Pencil className="w-3 h-3" />
              {lang === 'zh' ? '編輯' : 'Edit'}
            </button>
          )}

          {/* Bottom identity overlay */}
          <div className="absolute bottom-0 inset-x-0 z-20 p-4 sm:p-5">
            {/* Tier (small, de-emphasised) */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: accent }}
                aria-hidden
              />
              <p
                className="text-[10px] font-mono tracking-[0.3em] uppercase truncate"
                style={{ color: accent, opacity: 0.95 }}
              >
                {tierName}
              </p>
            </div>

            {/* Name (hero, large in portrait) */}
            <h2
              className="break-words"
              style={{
                fontFamily: 'var(--font-display), var(--font-noto-sans-tc), system-ui, sans-serif',
                fontWeight: 800,
                fontSize: 'clamp(28px, 11.5cqw, 44px)',
                lineHeight: 0.98,
                letterSpacing: '-0.02em',
                color: 'white',
                textShadow: '0 2px 8px rgba(0,0,0,0.55)',
                overflowWrap: 'anywhere',
              }}
            >
              {(profile?.displayName?.trim()) ||
                (email ? email.split('@')[0] : (memberNo ?? 'Member'))}
            </h2>

            {/* Member info chips */}
            <MemberInfoChips
              profile={profile}
              accent={accent}
              lang={lang}
            />
          </div>
        </div>

        {/* ===== Validity strip (between hero and info) ===== */}
        <div
          className="relative z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-y border-white/10"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <ValidityFoot
            tier={tier}
            rank={rank}
            validFrom={validFrom}
            validUntil={validUntil}
            lang={lang}
          />
          {memberNo && qrLabels && (
            <ChipQr
              memberNo={memberNo}
              accent={accent}
              surface={surface}
              onOpen={() => setShareOpen(true)}
              lang={lang}
            />
          )}
        </div>

        {/* ===== Info rows (stacked, hide when empty) ===== */}
        {showInfoSection && infoRows.length > 0 && (
          <div className="relative z-10 bg-black/40 backdrop-blur-[2px] divide-y divide-white/8">
            {infoRows.map((row) => (
              <div key={row.key} className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1 text-white/40">
                  <span aria-hidden>{row.icon}</span>
                  <p className="text-[10px] font-mono tracking-[0.2em] uppercase">
                    {row.label}
                  </p>
                </div>
                <div className="pl-[22px]">{row.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {memberNo && qrLabels && (
        <CardShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          memberNo={memberNo}
          displayName={profile?.displayName || email.split('@')[0] || memberNo}
          tierCode={levelCode}
          tierName={tierName}
          accent={accent}
          surface={surface}
          lang={lang}
          labels={qrLabels}
        />
      )}
    </motion.div>
  );
}
