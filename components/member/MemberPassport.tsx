'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import type { TicketTier } from '@/lib/members';
import CardShareModal from './CardShareModal';

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

function InlineField({
  value,
  placeholder,
  onSave,
  multiline,
  maxLength,
  className,
}: {
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  maxLength?: number;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    const shared = {
      ref: inputRef as never,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) { e.preventDefault(); save(); }
        if (e.key === 'Escape') cancel();
      },
      onBlur: save,
      maxLength,
      className: 'bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[13px] w-full outline-none focus:border-white/40 ' + (className ?? ''),
      placeholder,
    };
    return multiline ? <textarea {...shared} rows={2} /> : <input type="text" {...shared} />;
  }

  if (!value) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="text-left w-full rounded-lg bg-white/5 border border-dashed border-white/15 px-3 py-1.5 hover:bg-white/10 hover:border-white/25 transition-colors flex items-center gap-2"
      >
        <svg viewBox="0 0 16 16" className="w-3 h-3 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 3v10M3 8h10" />
        </svg>
        <span className={'text-white/35 text-[12px] ' + (className ?? '')}>{placeholder}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className={'text-left group inline-flex items-center gap-1 ' + (className ?? '')}
    >
      <span>{value}</span>
      <svg viewBox="0 0 16 16" className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11 2.5l2.5 2.5M4.5 9l-1 3.5L7 11.5 13 5.5 10.5 3l-6 6z" />
      </svg>
    </button>
  );
}

const COUNTRIES = [
  { code: 'TW', en: 'Taiwan', zh: '台灣' },
  { code: 'JP', en: 'Japan', zh: '日本' },
  { code: 'KR', en: 'South Korea', zh: '韓國' },
  { code: 'TH', en: 'Thailand', zh: '泰國' },
  { code: 'VN', en: 'Vietnam', zh: '越南' },
  { code: 'ID', en: 'Indonesia', zh: '印尼' },
  { code: 'MY', en: 'Malaysia', zh: '馬來西亞' },
  { code: 'SG', en: 'Singapore', zh: '新加坡' },
  { code: 'PH', en: 'Philippines', zh: '菲律賓' },
  { code: 'HK', en: 'Hong Kong', zh: '香港' },
  { code: 'CN', en: 'China', zh: '中國' },
  { code: 'US', en: 'United States', zh: '美國' },
  { code: 'CA', en: 'Canada', zh: '加拿大' },
  { code: 'GB', en: 'United Kingdom', zh: '英國' },
  { code: 'DE', en: 'Germany', zh: '德國' },
  { code: 'FR', en: 'France', zh: '法國' },
  { code: 'NL', en: 'Netherlands', zh: '荷蘭' },
  { code: 'ES', en: 'Spain', zh: '西班牙' },
  { code: 'PT', en: 'Portugal', zh: '葡萄牙' },
  { code: 'IT', en: 'Italy', zh: '義大利' },
  { code: 'SE', en: 'Sweden', zh: '瑞典' },
  { code: 'AU', en: 'Australia', zh: '澳洲' },
  { code: 'NZ', en: 'New Zealand', zh: '紐西蘭' },
  { code: 'MX', en: 'Mexico', zh: '墨西哥' },
  { code: 'CO', en: 'Colombia', zh: '哥倫比亞' },
  { code: 'BR', en: 'Brazil', zh: '巴西' },
  { code: 'AR', en: 'Argentina', zh: '阿根廷' },
  { code: 'TR', en: 'Turkey', zh: '土耳其' },
  { code: 'GE', en: 'Georgia', zh: '喬治亞' },
  { code: 'IN', en: 'India', zh: '印度' },
  { code: 'AE', en: 'UAE', zh: '阿聯酋' },
];

function parseLocation(location: string | null): { country: string; city: string } {
  if (!location) return { country: '', city: '' };
  const parts = location.split(',').map((s) => s.trim());
  if (parts.length >= 2) return { city: parts[0], country: parts.slice(1).join(', ') };
  const match = COUNTRIES.find((c) => c.en === location || c.zh === location);
  if (match) return { country: match.en, city: '' };
  return { city: location, country: '' };
}

function InlineLocationField({
  value,
  placeholder,
  onSave,
  lang,
}: {
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
  lang: 'en' | 'zh';
}) {
  const [editing, setEditing] = useState(false);
  const parsed = parseLocation(value);
  const [country, setCountry] = useState(parsed.country);
  const [city, setCity] = useState(parsed.city);

  const startEdit = () => {
    const p = parseLocation(value);
    setCountry(p.country);
    setCity(p.city);
    setEditing(true);
  };

  const save = () => {
    const parts = [city.trim(), country.trim()].filter(Boolean);
    onSave(parts.join(', '));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-1.5 w-full">
        <select
          autoFocus
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="bg-white/10 border border-white/20 rounded px-2 py-1.5 text-white text-[12px] w-full outline-none focus:border-white/40 appearance-none"
        >
          <option value="" className="bg-neutral-800">{lang === 'zh' ? '選擇國家' : 'Select country'}</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.en} className="bg-neutral-800">
              {lang === 'zh' ? `${c.zh} ${c.en}` : c.en}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            if (e.key === 'Escape') setEditing(false);
          }}
          placeholder={lang === 'zh' ? '城市' : 'City'}
          className="bg-white/10 border border-white/20 rounded px-2 py-1.5 text-white text-[12px] w-full outline-none focus:border-white/40"
        />
        <div className="flex gap-2">
          <button type="button" onClick={save} className="text-[11px] font-medium text-green-400 hover:text-green-300">
            {lang === 'zh' ? '儲存' : 'Save'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-white/40 hover:text-white/60">
            {lang === 'zh' ? '取消' : 'Cancel'}
          </button>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="w-full rounded-lg bg-white/5 border border-dashed border-white/15 px-3 py-1.5 hover:bg-white/10 hover:border-white/25 transition-colors flex items-center gap-2"
      >
        <svg viewBox="0 0 16 16" className="w-3 h-3 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 3v10M3 8h10" />
        </svg>
        <span className="text-white/35 text-[12px]">{placeholder}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="text-left group inline-flex items-center gap-1 text-[12px] text-white/70"
    >
      <span>{value}</span>
      <svg viewBox="0 0 16 16" className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11 2.5l2.5 2.5M4.5 9l-1 3.5L7 11.5 13 5.5 10.5 3l-6 6z" />
      </svg>
    </button>
  );
}

function InlineTagsField({
  tags,
  accent,
  onSave,
  placeholder,
}: {
  tags: string[];
  accent: string;
  onSave: (tags: string[]) => void;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tags.join(', '));

  const startEdit = () => {
    setDraft(tags.join(', '));
    setEditing(true);
  };

  const save = () => {
    const newTags = draft.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10);
    onSave(newTags);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          if (e.key === 'Escape') { setDraft(tags.join(', ')); setEditing(false); }
        }}
        onBlur={save}
        placeholder={placeholder}
        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[11px] w-full outline-none focus:border-white/40"
      />
    );
  }

  if (tags.length === 0) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="w-full rounded-lg bg-white/5 border border-dashed border-white/15 px-3 py-1.5 hover:bg-white/10 hover:border-white/25 transition-colors flex items-center gap-2"
      >
        <svg viewBox="0 0 16 16" className="w-3 h-3 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 3v10M3 8h10" />
        </svg>
        <span className="text-white/35 text-[12px]">{placeholder}</span>
      </button>
    );
  }

  return (
    <button type="button" onClick={startEdit} className="flex flex-wrap gap-1.5 group items-center">
      {tags.slice(0, 5).map((tag) => (
        <span
          key={tag}
          className="px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{ backgroundColor: `${accent}20`, color: accent }}
        >
          {tag}
        </span>
      ))}
      <svg viewBox="0 0 16 16" className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11 2.5l2.5 2.5M4.5 9l-1 3.5L7 11.5 13 5.5 10.5 3l-6 6z" />
      </svg>
    </button>
  );
}

const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', prefix: 'https://instagram.com/', icon: '@', placeholder: 'username' },
  { key: 'twitter', label: 'X / Twitter', prefix: 'https://x.com/', icon: '@', placeholder: 'handle' },
  { key: 'linkedin', label: 'LinkedIn', prefix: 'https://linkedin.com/in/', icon: 'in', placeholder: 'username' },
  { key: 'github', label: 'GitHub', prefix: 'https://github.com/', icon: '<>', placeholder: 'username' },
  { key: 'website', label: 'Website', prefix: '', icon: '🔗', placeholder: 'https://...' },
] as const;

function extractHandle(url: string, prefix: string): string {
  if (!url) return '';
  if (!prefix) return url;
  if (url.startsWith(prefix)) return url.slice(prefix.length).replace(/\/$/, '');
  const cleaned = url.replace(/^https?:\/\/(www\.)?/, '');
  const prefixClean = prefix.replace(/^https?:\/\/(www\.)?/, '');
  if (cleaned.startsWith(prefixClean)) return cleaned.slice(prefixClean.length).replace(/\/$/, '');
  return url;
}

function buildUrl(handle: string, prefix: string): string {
  if (!handle) return '';
  if (!prefix) return handle.startsWith('http') ? handle : `https://${handle}`;
  if (handle.startsWith('http')) return handle;
  return prefix + handle.replace(/^@/, '');
}

function InlineSocialLinks({
  links,
  onSave,
  lang,
}: {
  links: Record<string, string>;
  onSave: (links: Record<string, string>) => void;
  lang: 'en' | 'zh';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const startEdit = () => {
    const handles: Record<string, string> = {};
    for (const p of SOCIAL_PLATFORMS) {
      handles[p.key] = extractHandle(links[p.key] ?? '', p.prefix);
    }
    setDraft(handles);
    setEditing(true);
  };

  const save = () => {
    const cleaned: Record<string, string> = {};
    for (const p of SOCIAL_PLATFORMS) {
      const handle = (draft[p.key] ?? '').trim();
      if (handle) cleaned[p.key] = buildUrl(handle, p.prefix);
    }
    onSave(cleaned);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-1.5">
        {SOCIAL_PLATFORMS.map((p) => (
          <div key={p.key} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/50 w-6 shrink-0 text-center">{p.icon}</span>
            <div className="flex-1 flex items-center bg-white/10 border border-white/20 rounded overflow-hidden focus-within:border-white/40">
              {p.prefix && (
                <span className="text-[9px] text-white/30 pl-2 shrink-0 select-none">{p.prefix.replace('https://', '')}</span>
              )}
              <input
                type="text"
                value={draft[p.key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [p.key]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); } }}
                placeholder={p.placeholder}
                className="bg-transparent px-1.5 py-1 text-white text-[11px] flex-1 outline-none min-w-0"
              />
            </div>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={save} className="text-[11px] font-medium text-green-400 hover:text-green-300">
            {lang === 'zh' ? '儲存' : 'Save'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-white/40 hover:text-white/60">
            {lang === 'zh' ? '取消' : 'Cancel'}
          </button>
        </div>
      </div>
    );
  }

  const entries = Object.entries(links);
  if (entries.length === 0) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="w-full rounded-lg bg-white/5 border border-dashed border-white/15 px-3 py-1.5 hover:bg-white/10 hover:border-white/25 transition-colors flex items-center gap-2"
      >
        <svg viewBox="0 0 16 16" className="w-3 h-3 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 3v10M3 8h10" />
        </svg>
        <span className="text-white/35 text-[12px]">
          {lang === 'zh' ? '新增社群連結' : 'Add social links'}
        </span>
      </button>
    );
  }

  return (
    <button type="button" onClick={startEdit} className="flex flex-wrap gap-3 group items-center">
      {entries.map(([platform, url]) => (
        <a
          key={platform}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] font-mono text-white/60 hover:text-white/85 transition-colors"
        >
          {platform}
        </a>
      ))}
      <svg viewBox="0 0 16 16" className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11 2.5l2.5 2.5M4.5 9l-1 3.5L7 11.5 13 5.5 10.5 3l-6 6z" />
      </svg>
    </button>
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

function CardFoot({
  displayName,
  email,
  tier,
  rank,
  validFrom,
  validUntil,
  lang,
  editable,
  onSaveName,
}: {
  displayName: string | null;
  email: string;
  tier: IdentityTier;
  rank: number;
  validFrom?: string | null;
  validUntil?: string | null;
  lang: 'en' | 'zh';
  editable?: boolean;
  onSaveName?: (v: string) => void;
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
      {editable && onSaveName ? (
        <div className="max-w-full">
          <InlineField
            value={displayName ?? ''}
            placeholder={lang === 'zh' ? '持卡人姓名' : 'Cardholder'}
            onSave={onSaveName}
            maxLength={50}
            className="text-[14px] sm:text-[17px] font-bold text-white"
          />
        </div>
      ) : (
        <p className="text-[14px] sm:text-[17px] font-bold text-white truncate drop-shadow">
          {displayName || email.split('@')[0]}
        </p>
      )}
      <p className="mt-0.5 text-[9px] sm:text-[11px] font-mono tracking-[0.15em] uppercase text-white/65 truncate flex items-center gap-1.5">
        {hasValidity ? (
          <>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
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
        width: 'clamp(56px, 22cqw, 88px)',
        height: 'clamp(56px, 22cqw, 88px)',
        boxShadow: `0 0 0 1px ${accent}66, 0 4px 12px rgba(0,0,0,0.45)`,
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

function TierHeroText({ tier, tierName }: { tier: IdentityTier; tierName: string }) {
  const accent = TIER_ACCENT[tier];
  const text = tierName.toUpperCase();

  const baseStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display), var(--font-noto-sans-tc), system-ui, sans-serif',
    fontWeight: 900,
    fontSize: 'clamp(24px, 12cqw, 52px)',
    lineHeight: 0.9,
    letterSpacing: '-0.03em',
    textTransform: 'uppercase',
    overflowWrap: 'anywhere',
  };

  if (tier === 'backer') {
    return (
      <h2
        className="break-words motion-safe:animate-[foil_6s_linear_infinite]"
        style={{
          ...baseStyle,
          fontStyle: 'italic',
          backgroundImage: 'linear-gradient(96deg,#FFD028 0%,#FFFFFF 38%,#C54090 70%,#FFD028 100%)',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {text}
      </h2>
    );
  }

  if (tier === 'weekly_backer') {
    return (
      <h2
        className="break-words motion-safe:animate-[shimmer_4s_linear_infinite]"
        style={{
          ...baseStyle,
          backgroundImage: 'linear-gradient(100deg,#B8860B 0%,#FFD028 40%,#FFF3B0 55%,#FFD028 70%,#B8860B 100%)',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {text}
      </h2>
    );
  }

  if (tier === 'contribute') {
    return (
      <h2
        className="break-words"
        style={{
          ...baseStyle,
          color: accent,
          textShadow: `0 1px 0 rgba(0,0,0,0.35), 0 0 18px ${accent}66`,
        }}
      >
        {text}
      </h2>
    );
  }

  if (tier === 'explore') {
    return (
      <h2
        className="break-words"
        style={{ ...baseStyle, color: accent, textShadow: `0 0 22px ${accent}55` }}
      >
        {text}
      </h2>
    );
  }

  return (
    <h2 className="break-words" style={{ ...baseStyle, color: accent }}>
      {text}
    </h2>
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
  onProfileChange,
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
  const tagline = TIER_TAGLINES[tier][lang];
  const levelCode = TIER_NAMES[tier].code;
  const [shareOpen, setShareOpen] = useState(false);

  const saveField = useCallback((field: string, value: unknown) => {
    if (!profile || !onProfileChange) return;
    const updated = { ...profile, [field]: value };
    onProfileChange(updated);
    const snakeField = field.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    const payload = { [snakeField]: value };
    fetch('/api/member/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => onProfileChange(profile));
  }, [profile, onProfileChange]);

  const handleAvatarChange = useCallback((newUrl: string | null) => {
    if (!profile || !onProfileChange) return;
    onProfileChange({ ...profile, avatarUrl: newUrl });
  }, [profile, onProfileChange]);

  const showInfoPanel = !!profile;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
      className="relative w-full space-y-4"
    >
      {/* Landscape VIP card face */}
      <div
        className="relative overflow-hidden rounded-2xl text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]"
        style={{
          backgroundColor: surface,
          aspectRatio: '1.58 / 1',
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-1 z-20"
          style={{ background: accentBar }}
        />

        {pattern && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: pattern }}
            aria-hidden
          />
        )}

        <div
          className="absolute inset-0 pointer-events-none opacity-75"
          style={{ background: glow }}
          aria-hidden
        />

        <div className="relative z-10 flex h-full">
          <div
            className="relative shrink-0 overflow-hidden border-r border-white/10"
            style={{ width: '38%', containerType: 'inline-size' }}
          >
            <AvatarHero
              name={profile?.displayName ?? null}
              email={email}
              accent={accent}
              avatarUrl={profile?.avatarUrl}
              glow={glow}
              surface={surface}
              editable={editable && !!onProfileChange}
              lang={lang}
              onChange={handleAvatarChange}
            />
          </div>

          <div
            className="relative flex-1 flex flex-col min-w-0 p-3 sm:p-5 pt-4 sm:pt-6"
            style={{ containerType: 'inline-size' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-mono tracking-[0.25em] uppercase text-white/80">
                  TDF 2026
                </p>
                <p className="mt-0.5 text-[11px] sm:text-[13px] font-mono tracking-[0.12em] text-white/95">
                  {memberNo ?? 'M-———'}
                </p>
              </div>
              <ClearanceStars rank={rank} accent={accent} />
            </div>

            <div className="flex-1 flex flex-col justify-end pb-2 sm:pb-3 min-w-0">
              <TierHeroText tier={tier} tierName={tierName} />
              <p className="mt-1 sm:mt-2 text-[10px] sm:text-[12px] text-white/65 italic leading-snug line-clamp-2">
                {tagline}
              </p>
            </div>

            <div className="flex items-end justify-between gap-2 sm:gap-3">
              <CardFoot
                displayName={profile?.displayName ?? null}
                email={email}
                tier={tier}
                rank={rank}
                validFrom={validFrom}
                validUntil={validUntil}
                lang={lang}
                editable={editable && !!onProfileChange}
                onSaveName={editable && onProfileChange
                  ? (v) => saveField('displayName', v || null)
                  : undefined}
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
          </div>
        </div>
      </div>

      {/* Info panel below the card */}
      {showInfoPanel && (
        <div className="rounded-2xl bg-neutral-950/85 text-white border border-white/10 p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-[9px] font-mono tracking-[0.2em] uppercase text-white/40 mb-1.5">
                  {lang === 'zh' ? '所在地' : 'Location'}
                </p>
                {editable && profile ? (
                  <InlineLocationField
                    value={profile.location ?? ''}
                    placeholder={lang === 'zh' ? '新增所在地' : 'Add location'}
                    onSave={(v) => saveField('location', v || null)}
                    lang={lang}
                  />
                ) : (
                  <p className="text-[12px] text-white/70">{profile?.location || '—'}</p>
                )}
              </div>

              <div>
                <p className="text-[9px] font-mono tracking-[0.2em] uppercase text-white/40 mb-1.5">
                  {lang === 'zh' ? '自我介紹' : 'Bio'}
                </p>
                {editable && profile ? (
                  <InlineField
                    value={profile.bio ?? ''}
                    placeholder={lang === 'zh' ? '新增自我介紹' : 'Add bio'}
                    onSave={(v) => saveField('bio', v || null)}
                    multiline
                    maxLength={280}
                    className="text-[13px] text-white/80"
                  />
                ) : (
                  <p className="text-[13px] text-white/80 leading-relaxed">{profile?.bio || '—'}</p>
                )}
              </div>

              <div>
                <p className="text-[9px] font-mono tracking-[0.2em] uppercase text-white/40 mb-1.5">
                  {lang === 'zh' ? '標籤' : 'Tags'}
                </p>
                {editable && profile ? (
                  <InlineTagsField
                    tags={profile.tags}
                    accent={accent}
                    onSave={(v) => saveField('tags', v)}
                    placeholder={lang === 'zh' ? '新增標籤' : 'Add tags'}
                  />
                ) : profile && profile.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.tags.slice(0, 8).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ backgroundColor: `${accent}20`, color: accent }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-white/40">—</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[9px] font-mono tracking-[0.2em] uppercase text-white/40 mb-1.5">
                  {lang === 'zh' ? '社群連結' : 'Social'}
                </p>
                {editable && profile ? (
                  <InlineSocialLinks
                    links={profile.socialLinks}
                    onSave={(v) => saveField('socialLinks', v)}
                    lang={lang}
                  />
                ) : profile && Object.keys(profile.socialLinks).length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(profile.socialLinks).map(([platform, url]) => (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-white/60 hover:text-white/85 transition-colors"
                      >
                        {platform}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-white/40">—</p>
                )}
              </div>

              {memberNo && collectionsLabel && (
                <div>
                  <p className="text-[9px] font-mono tracking-[0.2em] uppercase text-white/40 mb-1.5">
                    {lang === 'zh' ? '收藏' : 'Collections'}
                  </p>
                  <Link
                    href="/me/collections"
                    className="inline-flex items-center gap-2 text-[13px] text-white/75 hover:text-white transition-colors"
                  >
                    <span>{collectionsLabel}</span>
                    {collectionsUnread > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                        {collectionsUnread}
                      </span>
                    )}
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
