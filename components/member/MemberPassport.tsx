'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
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
  // Check if it's just a country name
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
  if (!prefix) return url; // website: keep full URL
  if (url.startsWith(prefix)) return url.slice(prefix.length).replace(/\/$/, '');
  // Also handle with/without www, http vs https
  const cleaned = url.replace(/^https?:\/\/(www\.)?/, '');
  const prefixClean = prefix.replace(/^https?:\/\/(www\.)?/, '');
  if (cleaned.startsWith(prefixClean)) return cleaned.slice(prefixClean.length).replace(/\/$/, '');
  return url;
}

function buildUrl(handle: string, prefix: string): string {
  if (!handle) return '';
  if (!prefix) return handle.startsWith('http') ? handle : `https://${handle}`; // website
  if (handle.startsWith('http')) return handle; // already full URL
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
    // Convert URLs to handles for display
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
      <div className="space-y-1.5 mt-2">
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
        className="w-full rounded-lg bg-white/5 border border-dashed border-white/15 px-3 py-1.5 hover:bg-white/10 hover:border-white/25 transition-colors flex items-center gap-2 mt-2"
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
    <button type="button" onClick={startEdit} className="flex flex-wrap gap-3 group items-center mt-2">
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
      <span className="text-white/75">
        {from} → {until}
      </span>
      {isUpcoming && (
        <span className="text-white/55">
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

  const saveField = useCallback((field: string, value: unknown) => {
    if (!profile || !onProfileChange) return;
    const updated = { ...profile, [field]: value };
    onProfileChange(updated);
    // Persist to API
    const snakeField = field.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    const payload = { [snakeField]: value };
    fetch('/api/member/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => onProfileChange(profile)); // rollback on error
  }, [profile, onProfileChange]);

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
  };

  const tierName = TIER_NAMES[tier][lang] || TIER_NAMES[tier].en;
  const tagline = TIER_TAGLINES[tier][lang];

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
            <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/65">
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

          {/* Profile: avatar + name + bio + tags + social links (inline editable) */}
          <div className="mt-5 flex items-start gap-4">
            <MemberAvatar name={profile?.displayName ?? null} email={email} accent={accent} avatarUrl={profile?.avatarUrl} size={52} />
            <div className="min-w-0 flex-1 space-y-1">
              {editable && profile ? (
                <>
                  <InlineField
                    value={profile.displayName ?? ''}
                    placeholder={lang === 'zh' ? '顯示名稱' : 'Display name'}
                    onSave={(v) => saveField('displayName', v || null)}
                    maxLength={50}
                    className="text-[16px] font-bold text-white"
                  />
                  <InlineLocationField
                    value={profile.location ?? ''}
                    placeholder={lang === 'zh' ? '所在地' : 'Location'}
                    onSave={(v) => saveField('location', v || null)}
                    lang={lang}
                  />
                  <InlineField
                    value={profile.bio ?? ''}
                    placeholder={lang === 'zh' ? '自我介紹' : 'Bio'}
                    onSave={(v) => saveField('bio', v || null)}
                    multiline
                    maxLength={280}
                    className="text-[13px] text-white/75"
                  />
                  <InlineTagsField
                    tags={profile.tags}
                    accent={accent}
                    onSave={(v) => saveField('tags', v)}
                    placeholder={lang === 'zh' ? '新增標籤' : 'Add tags'}
                  />
                  <InlineSocialLinks
                    links={profile.socialLinks}
                    onSave={(v) => saveField('socialLinks', v)}
                    lang={lang}
                  />
                </>
              ) : (
                <>
                  <p className="text-[16px] font-bold text-white truncate">
                    {profile?.displayName || email.split('@')[0]}
                  </p>
                  {profile?.location && (
                    <p className="text-[12px] text-white/70 truncate">{profile.location}</p>
                  )}
                  {profile?.bio && (
                    <p className="text-[13px] text-white/75 line-clamp-2">{profile.bio}</p>
                  )}
                  {profile && profile.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
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
                  {profile && Object.keys(profile.socialLinks).length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-1">
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
                  )}
                </>
              )}
            </div>
          </div>

          {/* Validity period — primary secondary info */}
          {tier !== 'follower' && validFrom && validUntil ? (
            <div className="mt-4">
              <ValidityBadge validFrom={validFrom} validUntil={validUntil} lang={lang} />
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-white/50 italic">{tagline}</p>
          )}

          {/* QR Code */}
          {publicUrl && profile?.isPublic && (
            <div className="mt-5 flex flex-col items-center gap-3">
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
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
