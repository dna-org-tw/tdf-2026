'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import CountryCombobox from '@/components/member/CountryCombobox';

const SKIP_KEY = 'tdf_profile_complete_skipped_at_v1';
const DRAFT_KEY = 'tdf_profile_complete_draft_v1';
const SKIP_DURATION_MS = 60 * 60 * 1000;

function isSkipActive(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(SKIP_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  if (Date.now() - ts >= SKIP_DURATION_MS) {
    window.localStorage.removeItem(SKIP_KEY);
    return false;
  }
  return true;
}

interface Draft {
  displayName?: string;
  nationality?: string;
  city?: string;
  country?: string;
  workTypes?: string[];
  nomadIdx?: number | null;
  bio?: string;
  tagsInput?: string;
  languages?: string;
  socialLinks?: Record<string, string>;
}

function loadDraft(): Draft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveDraft(d: Draft) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

function clearDraft() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DRAFT_KEY);
}

const WORK_TYPES = [
  'admin_mgmt',
  'sales_marketing',
  'finance_legal',
  'it_engineering',
  'design_creative',
  'education_research',
  'healthcare_social',
  'tourism_hospitality',
  'manufacturing_logistics',
  'freelance_entrepreneur',
] as const;
type WorkType = typeof WORK_TYPES[number];

const NOMAD_BUCKETS = [
  'not_yet',
  'under_3m',
  '3m_to_1y',
  '1_to_3y',
  '3_to_5y',
  '5_to_10y',
  'over_10y',
] as const;
type NomadBucket = typeof NOMAD_BUCKETS[number];

const SOCIAL_PLATFORMS = ['instagram', 'twitter', 'linkedin', 'github', 'website'] as const;

function parseLocation(loc: string | null): { city: string; country: string } {
  if (!loc) return { city: '', country: '' };
  const parts = loc.split(',').map((s) => s.trim());
  if (parts.length >= 2) return { city: parts[0], country: parts.slice(1).join(', ') };
  return { city: loc, country: '' };
}

function joinLocation(city: string, country: string): string {
  return [city.trim(), country.trim()].filter(Boolean).join(', ');
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function SaveStatusBadge({
  status,
  labels,
}: {
  status: SaveStatus;
  labels: { statusSaving: string; statusSaved: string; statusError: string };
}) {
  if (status === 'idle') {
    return <span aria-hidden className="text-[12px] text-slate-300">·</span>;
  }
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
        <span className="w-3 h-3 border-[1.5px] border-slate-400 border-t-transparent rounded-full animate-spin" />
        {labels.statusSaving}
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-600">
        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
        {labels.statusSaved}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-red-600">
      {labels.statusError}
    </span>
  );
}

export default function ProfileEditModal() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  // 'completion' = auto-opened due to missing required fields (Fill later allowed).
  // 'edit'       = manually triggered from card; full edit, no Fill later.
  const [mode, setMode] = useState<'completion' | 'edit'>('edit');
  const hydratedRef = useRef(false);

  // Form state — all fields
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [nationality, setNationality] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [workTypes, setWorkTypes] = useState<Set<WorkType>>(new Set());
  const [nomadIdx, setNomadIdx] = useState<number | null>(null);
  const [bio, setBio] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [languages, setLanguages] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const labels = useMemo(() => lang === 'zh' ? {
    titleEdit: '編輯會員名片',
    titleCompletion: '完成你的會員資料',
    subtitleCompletion: '幾個簡單的問題，幫助我們為你打造更好的活動體驗。',
    skip: '稍後填寫',
    done: '完成',
    requiredHint: '姓名、國籍、工作型態、遊牧資歷與居住地為必填',
    statusSaving: '儲存中…',
    statusSaved: '已儲存',
    statusError: '儲存失敗，將自動重試',
    completeReady: '✓ 必填項目已完成',
    cancel: '取消',
    avatar: '頭像',
    upload: '上傳',
    uploading: '上傳中…',
    remove: '移除',
    avatarHint: 'JPEG / PNG / WebP，最大 2 MB',
    name: '姓名',
    namePlaceholder: '你的稱呼',
    nationality: '國籍',
    nationalityPlaceholder: '選擇國籍',
    workType: '工作型態（可複選）',
    nomad: '數位遊牧資歷',
    location: '居住地或旅居地',
    countryFirst: '所在國家',
    cityPlaceholder: '城市',
    bio: '自我介紹',
    bioPlaceholder: '說說你的故事…',
    bioHint: '最多 280 字',
    tags: '標籤',
    addTag: '新增標籤後按 Enter',
    languages: '語言',
    languagesHint: '用逗號分隔，例：English, 中文',
    social: '社群連結',
    errorGeneric: '儲存失敗，請稍後再試',
    errorAvatar: '頭像上傳失敗',
    errorAvatarFormat: '僅支援 JPEG / PNG / WebP',
    errorAvatarSize: '檔案不可超過 2 MB',
    work: {
      admin_mgmt: '行政 / 管理',
      sales_marketing: '銷售 / 市場行銷',
      finance_legal: '財務 / 會計 / 法務',
      it_engineering: '資訊科技 / 工程',
      design_creative: '設計 / 創意 / 媒體',
      education_research: '教育 / 培訓 / 研究',
      healthcare_social: '醫療 / 保健 / 社會服務',
      tourism_hospitality: '旅遊 / 酒店 / 服務業',
      manufacturing_logistics: '製造 / 物流 / 供應鏈',
      freelance_entrepreneur: '自由職業 / 創業',
    } as Record<WorkType, string>,
    nomadLabels: {
      not_yet: '尚未',
      under_3m: '< 3 個月',
      '3m_to_1y': '3 個月 – 1 年',
      '1_to_3y': '1 – 3 年',
      '3_to_5y': '3 – 5 年',
      '5_to_10y': '5 – 10 年',
      over_10y: '> 10 年',
    } as Record<NomadBucket, string>,
  } : {
    titleEdit: 'Edit member card',
    titleCompletion: 'Complete your member profile',
    subtitleCompletion: 'A few quick questions so we can tailor the festival experience.',
    skip: 'Fill later',
    requiredHint: 'Name, nationality, work type, nomad experience and location are required',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    avatar: 'Avatar',
    upload: 'Upload',
    uploading: 'Uploading…',
    remove: 'Remove',
    avatarHint: 'JPEG / PNG / WebP. Max 2 MB.',
    name: 'Name',
    namePlaceholder: 'How should we call you?',
    nationality: 'Nationality',
    nationalityPlaceholder: 'Select nationality',
    workType: 'Work type (multi-select)',
    nomad: 'Nomad experience',
    location: 'Residence or nomad base',
    countryFirst: 'Country',
    cityPlaceholder: 'City',
    bio: 'Bio',
    bioPlaceholder: 'Tell your story…',
    bioHint: 'Max 280 characters',
    tags: 'Tags',
    addTag: 'Type a tag and press Enter',
    languages: 'Languages',
    languagesHint: 'Comma-separated, e.g. English, 中文',
    social: 'Social links',
    errorGeneric: 'Failed to save. Please try again.',
    errorAvatar: 'Avatar upload failed',
    errorAvatarFormat: 'Only JPEG / PNG / WebP allowed',
    errorAvatarSize: 'File must be under 2 MB',
    statusSaving: 'Saving…',
    statusSaved: 'Saved',
    statusError: 'Save failed, will retry',
    completeReady: '✓ Required fields complete',
    done: 'Done',
    work: {
      admin_mgmt: 'Administration / Management',
      sales_marketing: 'Sales / Marketing',
      finance_legal: 'Finance / Accounting / Legal',
      it_engineering: 'IT / Engineering',
      design_creative: 'Design / Creative / Media',
      education_research: 'Education / Training / Research',
      healthcare_social: 'Healthcare / Social Services',
      tourism_hospitality: 'Tourism / Hospitality',
      manufacturing_logistics: 'Manufacturing / Logistics',
      freelance_entrepreneur: 'Freelancer / Entrepreneur',
    } as Record<WorkType, string>,
    nomadLabels: {
      not_yet: 'Not yet',
      under_3m: '< 3 months',
      '3m_to_1y': '3 months – 1 year',
      '1_to_3y': '1 – 3 years',
      '3_to_5y': '3 – 5 years',
      '5_to_10y': '5 – 10 years',
      over_10y: '> 10 years',
    } as Record<NomadBucket, string>,
  }, [lang]);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Use the completion endpoint so we also get the `complete` flag and
      // any name-prefill fallback from members_enriched.
      const res = await fetch('/api/member/profile-completion');
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error('failed');
      }
      const data = await res.json();
      const v = data.values ?? {};

      setDisplayName(v.display_name ?? '');
      setNationality(v.nationality ?? '');
      const { city: c, country: co } = parseLocation(v.location ?? null);
      setCity(c);
      setCountry(co);
      const persistedWork = (v.work_types ?? [])
        .filter((w: string): w is WorkType => (WORK_TYPES as readonly string[]).includes(w));
      setWorkTypes(new Set(persistedWork));
      const idx = v.nomad_experience
        ? NOMAD_BUCKETS.indexOf(v.nomad_experience as NomadBucket)
        : -1;
      setNomadIdx(idx >= 0 ? idx : null);

      // Pull the rest (avatar/bio/tags/languages/social) from the regular profile route
      try {
        const fullRes = await fetch('/api/member/profile');
        if (fullRes.ok) {
          const full = await fullRes.json();
          setAvatarUrl(full.avatar_url ?? null);
          setBio(full.bio ?? '');
          setTagsInput((full.tags ?? []).join(','));
          setLanguages((full.languages ?? []).join(', '));
          setSocialLinks(full.social_links ?? {});
        }
      } catch {
        /* non-fatal — the completion data is already loaded */
      }

      // Overlay locally-saved draft so unsaved keystrokes survive refresh
      const draft = loadDraft();
      if (draft) {
        if (typeof draft.displayName === 'string') setDisplayName(draft.displayName);
        if (typeof draft.nationality === 'string') setNationality(draft.nationality);
        if (typeof draft.city === 'string') setCity(draft.city);
        if (typeof draft.country === 'string') setCountry(draft.country);
        if (Array.isArray(draft.workTypes)) {
          setWorkTypes(new Set(
            draft.workTypes.filter((w): w is WorkType => (WORK_TYPES as readonly string[]).includes(w)),
          ));
        }
        if (draft.nomadIdx === null || typeof draft.nomadIdx === 'number') {
          setNomadIdx(draft.nomadIdx ?? null);
        }
        if (typeof draft.bio === 'string') setBio(draft.bio);
        if (typeof draft.tagsInput === 'string') setTagsInput(draft.tagsInput);
        if (typeof draft.languages === 'string') setLanguages(draft.languages);
        if (draft.socialLinks && typeof draft.socialLinks === 'object') {
          setSocialLinks(draft.socialLinks);
        }
      }

      hydratedRef.current = true;
      return data as { complete: boolean };
    } catch {
      setError(labels.errorGeneric);
      return null;
    } finally {
      setLoading(false);
    }
  }, [labels.errorGeneric]);

  // Auto-open on login if profile is incomplete (completion mode)
  useEffect(() => {
    if (authLoading) return;
    if (!user?.email) {
      setOpen(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const skipped = isSkipActive();
      const data = await fetchProfile();
      if (cancelled || !data) return;
      if (!data.complete && !skipped) {
        setMode('completion');
        setOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user?.email, fetchProfile]);

  // Manual open from Edit button → 'edit' mode (full edit, no Fill later)
  useEffect(() => {
    const handler = async () => {
      if (!user?.email) return;
      await fetchProfile();
      setMode('edit');
      setOpen(true);
    };
    window.addEventListener('open-profile-editor', handler);
    return () => window.removeEventListener('open-profile-editor', handler);
  }, [user?.email, fetchProfile]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Autosave draft on every change (after initial hydrate)
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveDraft({
      displayName,
      nationality,
      city,
      country,
      workTypes: Array.from(workTypes),
      nomadIdx,
      bio,
      tagsInput,
      languages,
      socialLinks,
    });
  }, [displayName, nationality, city, country, workTypes, nomadIdx, bio, tagsInput, languages, socialLinks]);

  // ===== Auto-save: debounced PUT to /api/member/profile on every form change =====
  const buildPayload = useCallback(() => {
    const tagsArr = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);
    return {
      display_name: displayName.trim() || null,
      nationality: nationality.trim() || null,
      location: joinLocation(city, country) || null,
      work_types: Array.from(workTypes),
      nomad_experience: nomadIdx === null ? null : NOMAD_BUCKETS[nomadIdx],
      bio: bio.trim() || null,
      tags: tagsArr,
      languages: languages.split(',').map((l) => l.trim()).filter(Boolean),
      social_links: socialLinks,
    };
  }, [displayName, nationality, city, country, workTypes, nomadIdx, bio, tagsInput, languages, socialLinks]);

  useEffect(() => {
    if (!hydratedRef.current || !open) return;
    const t = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const res = await fetch('/api/member/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        });
        if (!res.ok) throw new Error();
        setSaveStatus('saved');
        if (typeof window !== 'undefined') window.localStorage.removeItem(SKIP_KEY);
        clearDraft();
        window.dispatchEvent(new CustomEvent('profile-completion-saved'));
        setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
      } catch {
        setSaveStatus('error');
      }
    }, 700);
    return () => clearTimeout(t);
  }, [open, buildPayload]);

  const handleSkip = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SKIP_KEY, String(Date.now()));
    }
    setOpen(false);
  };

  if (!user?.email) return null;

  const inputClass = 'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent transition';
  const labelClass = 'block text-[11px] font-medium text-slate-500 uppercase tracking-[0.12em] mb-1.5';

  const tags = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);

  const addTag = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const next = Array.from(new Set([...tags, trimmed])).slice(0, 10);
    setTagsInput(next.join(','));
    setTagDraft('');
  };

  const removeTag = (t: string) => {
    setTagsInput(tags.filter((x) => x !== t).join(','));
  };

  const toggleWork = (w: WorkType) => {
    setWorkTypes((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w); else next.add(w);
      return next;
    });
  };

  const setSocialLink = (platform: string, value: string) => {
    setSocialLinks((prev) => {
      const updated = { ...prev };
      if (value.trim()) updated[platform] = value.trim();
      else delete updated[platform];
      return updated;
    });
  };

  const handleAvatarUpload = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(labels.errorAvatarFormat);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(labels.errorAvatarSize);
      return;
    }
    setAvatarBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/member/avatar', { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAvatarUrl(data.avatar_url ?? null);
    } catch {
      setError(labels.errorAvatar);
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarBusy(true);
    setError('');
    try {
      const res = await fetch('/api/member/avatar', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setAvatarUrl(null);
    } catch {
      setError(labels.errorAvatar);
    } finally {
      setAvatarBusy(false);
    }
  };

  const requiredOk =
    displayName.trim().length > 0 &&
    nationality.trim().length > 0 &&
    workTypes.size > 0 &&
    nomadIdx !== null &&
    (city.trim() || country.trim()) !== '';

  const sliderValue = nomadIdx ?? 0;
  const sliderPct = (sliderValue / (NOMAD_BUCKETS.length - 1)) * 100;
  const currentNomadLabel = nomadIdx !== null
    ? labels.nomadLabels[NOMAD_BUCKETS[nomadIdx]]
    : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[200]"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-edit-title"
          >
            <div className="w-full max-w-xl my-auto" onClick={(e) => e.stopPropagation()}>
              <div
                className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
              >
                <div className="h-1 bg-gradient-to-r from-[#10B8D9] via-[#52D472] to-[#FFD028]" />

                <div className="p-5 sm:p-7 space-y-5 max-h-[calc(100vh-3rem)] overflow-y-auto">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2
                        id="profile-edit-title"
                        className="text-[20px] sm:text-[22px] font-bold text-slate-900 leading-tight"
                      >
                        {mode === 'completion' ? labels.titleCompletion : labels.titleEdit}
                      </h2>
                      {mode === 'completion' && (
                        <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">
                          {labels.subtitleCompletion}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => mode === 'completion' ? handleSkip() : setOpen(false)}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={mode === 'completion' ? labels.skip : labels.cancel}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-6 h-6 border-2 border-[#10B8D9] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* Avatar */}
                      <div>
                        <label className={labelClass}>{labels.avatar}</label>
                        <div className="flex items-center gap-4">
                          {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-lg font-bold">
                              {(displayName || user.email || '?').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="flex flex-col gap-1.5">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleAvatarUpload(f);
                                e.target.value = '';
                              }}
                            />
                            <button
                              type="button"
                              disabled={avatarBusy}
                              onClick={() => fileInputRef.current?.click()}
                              className="text-sm text-[#10B8D9] hover:text-[#0EA5C4] disabled:opacity-50 font-medium text-left"
                            >
                              {avatarBusy ? labels.uploading : labels.upload}
                            </button>
                            {avatarUrl && (
                              <button
                                type="button"
                                disabled={avatarBusy}
                                onClick={handleAvatarRemove}
                                className="text-sm text-red-400 hover:text-red-500 disabled:opacity-50 text-left"
                              >
                                {labels.remove}
                              </button>
                            )}
                            <p className="text-[10px] text-slate-400">{labels.avatarHint}</p>
                          </div>
                        </div>
                      </div>

                      {/* Name + Nationality */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>{labels.name}</label>
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            maxLength={50}
                            placeholder={labels.namePlaceholder}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{labels.nationality}</label>
                          <CountryCombobox
                            value={nationality}
                            onChange={setNationality}
                            placeholder={labels.nationalityPlaceholder}
                            lang={lang}
                            inputClassName={inputClass}
                            ariaLabel={labels.nationality}
                          />
                        </div>
                      </div>

                      {/* Work types */}
                      <div>
                        <label className={labelClass}>{labels.workType}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {WORK_TYPES.map((w) => {
                            const active = workTypes.has(w);
                            return (
                              <button
                                key={w}
                                type="button"
                                onClick={() => toggleWork(w)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12.5px] font-medium text-left transition-colors ${
                                  active
                                    ? 'border-[#10B8D9] bg-[#10B8D9]/8 text-[#0EA5C4] ring-1 ring-[#10B8D9]/30'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                }`}
                                aria-pressed={active}
                              >
                                <span
                                  className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                                    active ? 'bg-[#10B8D9] border-[#10B8D9]' : 'border-slate-300'
                                  }`}
                                  aria-hidden
                                >
                                  {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                </span>
                                <span className="leading-tight">{labels.work[w]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Nomad slider */}
                      <div>
                        <label className={labelClass}>{labels.nomad}</label>
                        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {labels.nomadLabels[NOMAD_BUCKETS[0]]}
                            </span>
                            <span
                              className={`text-[14px] font-bold transition-colors ${
                                nomadIdx === null ? 'text-slate-400' : 'text-[#0EA5C4]'
                              }`}
                            >
                              {currentNomadLabel ?? '—'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {labels.nomadLabels[NOMAD_BUCKETS[NOMAD_BUCKETS.length - 1]]}
                            </span>
                          </div>
                          <div className="relative">
                            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#10B8D9] to-[#52D472] transition-all"
                                style={{ width: nomadIdx === null ? '0%' : `${sliderPct}%` }}
                              />
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={NOMAD_BUCKETS.length - 1}
                              step={1}
                              value={sliderValue}
                              onChange={(e) => setNomadIdx(Number(e.target.value))}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              aria-label={labels.nomad}
                            />
                            <span
                              className={`absolute -top-1 w-4 h-4 rounded-full bg-white border-2 shadow-md pointer-events-none transition-all ${
                                nomadIdx === null ? 'border-slate-300 opacity-60' : 'border-[#10B8D9]'
                              }`}
                              style={{ left: `calc(${nomadIdx === null ? 0 : sliderPct}% - 8px)` }}
                              aria-hidden
                            />
                          </div>
                        </div>
                      </div>

                      {/* Location */}
                      <div>
                        <label className={labelClass}>{labels.location}</label>
                        <div className="space-y-2">
                          <CountryCombobox
                            value={country}
                            onChange={setCountry}
                            placeholder={labels.countryFirst}
                            lang={lang}
                            inputClassName={inputClass}
                            ariaLabel={labels.countryFirst}
                          />
                          <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            maxLength={60}
                            placeholder={labels.cityPlaceholder}
                            className={inputClass}
                          />
                        </div>
                      </div>

                      {/* Bio */}
                      <div>
                        <label className={labelClass}>{labels.bio}</label>
                        <textarea
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          maxLength={280}
                          rows={3}
                          placeholder={labels.bioPlaceholder}
                          className={`${inputClass} resize-none`}
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          {bio.length}/280 · {labels.bioHint}
                        </p>
                      </div>

                      {/* Tags */}
                      <div>
                        <label className={labelClass}>{labels.tags}</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#10B8D9]/10 text-[#10B8D9] hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              {tag}
                              <span aria-hidden>&times;</span>
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTag(tagDraft);
                            }
                          }}
                          maxLength={30}
                          placeholder={labels.addTag}
                          className={inputClass}
                        />
                      </div>

                      {/* Languages */}
                      <div>
                        <label className={labelClass}>{labels.languages}</label>
                        <input
                          type="text"
                          value={languages}
                          onChange={(e) => setLanguages(e.target.value)}
                          placeholder={labels.languagesHint}
                          className={inputClass}
                        />
                      </div>

                      {/* Social */}
                      <div>
                        <label className={labelClass}>{labels.social}</label>
                        <div className="space-y-2">
                          {SOCIAL_PLATFORMS.map((p) => (
                            <div key={p} className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-slate-400 w-16 shrink-0 capitalize">{p}</span>
                              <input
                                type="url"
                                value={socialLinks[p] ?? ''}
                                onChange={(e) => setSocialLink(p, e.target.value)}
                                placeholder={`https://${p}.com/...`}
                                className={`${inputClass} flex-1`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {error && (
                        <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                          {error}
                        </div>
                      )}

                      {/* Save status indicator + close action */}
                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <SaveStatusBadge status={saveStatus} labels={labels} />
                        <div className="flex items-center gap-2">
                          {mode === 'completion' && !requiredOk && (
                            <button
                              type="button"
                              onClick={handleSkip}
                              className="text-[13px] font-medium text-slate-500 hover:text-slate-700 transition-colors px-3 py-2"
                            >
                              {labels.skip}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setOpen(false)}
                            disabled={mode === 'completion' && !requiredOk}
                            className="bg-[#0E0E10] hover:bg-[#2A2A2E] disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2 px-5 rounded-lg transition-colors text-[13px]"
                          >
                            {labels.done}
                          </button>
                        </div>
                      </div>

                      {mode === 'completion' && !requiredOk && (
                        <p className="text-[11px] text-slate-400 text-right -mt-1">
                          {labels.requiredHint}
                        </p>
                      )}
                      {mode === 'completion' && requiredOk && (
                        <p className="text-[11px] text-emerald-600 text-right -mt-1">
                          {labels.completeReady}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
