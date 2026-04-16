'use client';

import { useState, useRef } from 'react';
import type { MemberProfile } from './MemberPassport';

const SUGGESTED_TAGS = [
  'Developer', 'Designer', 'Creator', 'Writer', 'Photographer',
  'Founder', 'Freelancer', 'Remote Worker', 'Digital Nomad', 'Marketer',
];

const SOCIAL_PLATFORMS = [
  'twitter', 'instagram', 'linkedin', 'github', 'website',
] as const;

interface ProfileEditorProps {
  profile: MemberProfile;
  lang: 'en' | 'zh';
  onSave: (updated: MemberProfile) => void;
  onCancel: () => void;
}

export default function ProfileEditor({ profile, lang, onSave, onCancel }: ProfileEditorProps) {
  const [form, setForm] = useState({
    displayName: profile.displayName ?? '',
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    timezone: profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    tags: [...profile.tags],
    languages: profile.languages.join(', '),
    socialLinks: { ...profile.socialLinks },
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tagInput, setTagInput] = useState('');

  const labels = lang === 'zh' ? {
    title: '編輯名片',
    displayName: '顯示名稱',
    bio: '自我介紹',
    location: '所在地',
    timezone: '時區',
    tags: '標籤',
    languages: '語言',
    socialLinks: '社群連結',
    save: '儲存',
    cancel: '取消',
    saving: '儲存中…',
    addTag: '新增標籤',
    bioHint: '最多 280 字',
    langHint: '用逗號分隔，如：English, 中文',
    avatar: '頭像',
    uploadAvatar: '上傳照片',
    removeAvatar: '移除',
    avatarHint: 'JPEG、PNG 或 WebP，最大 2 MB',
  } : {
    title: 'Edit Card',
    displayName: 'Display Name',
    bio: 'Bio',
    location: 'Location',
    timezone: 'Timezone',
    tags: 'Tags',
    languages: 'Languages',
    socialLinks: 'Social Links',
    save: 'Save',
    cancel: 'Cancel',
    saving: 'Saving…',
    addTag: 'Add tag',
    bioHint: 'Max 280 characters',
    langHint: 'Comma-separated, e.g. English, 中文',
    avatar: 'Avatar',
    uploadAvatar: 'Upload Photo',
    removeAvatar: 'Remove',
    avatarHint: 'JPEG, PNG, or WebP. Max 2 MB.',
  };

  const handleAvatarUpload = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(lang === 'zh' ? '僅支援 JPEG、PNG 或 WebP 格式' : 'Only JPEG, PNG, or WebP allowed');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(lang === 'zh' ? '檔案大小不可超過 2 MB' : 'File must be under 2 MB');
      return;
    }

    setAvatarUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/member/avatar', { method: 'POST', body: formData });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAvatarPreview(data.avatar_url);
    } catch {
      setError(lang === 'zh' ? '上傳失敗' : 'Upload failed');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarUploading(true);
    setError('');
    try {
      const res = await fetch('/api/member/avatar', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setAvatarPreview(null);
    } catch {
      setError(lang === 'zh' ? '移除失敗' : 'Failed to remove avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || form.tags.length >= 10 || form.tags.includes(trimmed)) return;
    setForm((f) => ({ ...f, tags: [...f.tags, trimmed] }));
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  };

  const setSocialLink = (platform: string, value: string) => {
    setForm((f) => {
      const updated = { ...f.socialLinks };
      if (value.trim()) {
        updated[platform] = value;
      } else {
        delete updated[platform];
      }
      return { ...f, socialLinks: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      display_name: form.displayName.trim() || null,
      bio: form.bio.trim() || null,
      location: form.location.trim() || null,
      timezone: form.timezone.trim() || null,
      tags: form.tags,
      languages: form.languages.split(',').map((l) => l.trim()).filter(Boolean),
      social_links: form.socialLinks,
    };

    try {
      const res = await fetch('/api/member/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');

      const data = await res.json();
      onSave({
        displayName: data.display_name ?? null,
        bio: data.bio ?? null,
        avatarUrl: avatarPreview ?? data.avatar_url ?? null,
        location: data.location ?? null,
        timezone: data.timezone ?? null,
        tags: data.tags ?? [],
        languages: data.languages ?? [],
        socialLinks: data.social_links ?? {},
        isPublic: data.is_public ?? profile.isPublic,
      });
    } catch {
      setError(lang === 'zh' ? '儲存失敗，請稍後再試' : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent';
  const labelClass = 'block text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">{labels.title}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          {labels.cancel}
        </button>
      </div>

      {/* Avatar */}
      <div>
        <label className={labelClass}>{labels.avatar}</label>
        <div className="flex items-center gap-4">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-lg font-bold">
              {(form.displayName || '??').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarUpload(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={avatarUploading}
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-[#10B8D9] hover:text-[#0EA5C4] disabled:opacity-50 font-medium transition-colors text-left"
            >
              {avatarUploading ? (lang === 'zh' ? '上傳中…' : 'Uploading…') : labels.uploadAvatar}
            </button>
            {avatarPreview && (
              <button
                type="button"
                disabled={avatarUploading}
                onClick={handleAvatarRemove}
                className="text-sm text-red-400 hover:text-red-500 disabled:opacity-50 transition-colors text-left"
              >
                {labels.removeAvatar}
              </button>
            )}
            <p className="text-[10px] text-slate-400">{labels.avatarHint}</p>
          </div>
        </div>
      </div>

      {/* Display Name */}
      <div>
        <label className={labelClass}>{labels.displayName}</label>
        <input
          type="text"
          value={form.displayName}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          maxLength={50}
          className={inputClass}
        />
      </div>

      {/* Bio */}
      <div>
        <label className={labelClass}>{labels.bio}</label>
        <textarea
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          maxLength={280}
          rows={3}
          className={inputClass + ' resize-none'}
        />
        <p className="text-[11px] text-slate-400 mt-1">{form.bio.length}/280 · {labels.bioHint}</p>
      </div>

      {/* Location */}
      <div>
        <label className={labelClass}>{labels.location}</label>
        <input
          type="text"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          maxLength={100}
          placeholder={lang === 'zh' ? '例：台北、東京' : 'e.g. Taipei, Tokyo'}
          className={inputClass}
        />
      </div>

      {/* Timezone */}
      <div>
        <label className={labelClass}>{labels.timezone}</label>
        <input
          type="text"
          value={form.timezone}
          onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          placeholder="Asia/Taipei"
          className={inputClass}
        />
      </div>

      {/* Tags */}
      <div>
        <label className={labelClass}>{labels.tags}</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.tags.map((tag) => (
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
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            placeholder={labels.addTag}
            maxLength={30}
            className={inputClass + ' flex-1'}
          />
        </div>
        {form.tags.length < 10 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SUGGESTED_TAGS.filter((t) => !form.tags.includes(t)).slice(0, 6).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="px-2 py-0.5 rounded-full text-[10px] border border-slate-200 text-slate-400 hover:border-[#10B8D9] hover:text-[#10B8D9] transition-colors"
              >
                + {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Languages */}
      <div>
        <label className={labelClass}>{labels.languages}</label>
        <input
          type="text"
          value={form.languages}
          onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))}
          placeholder={labels.langHint}
          className={inputClass}
        />
      </div>

      {/* Social Links */}
      <div>
        <label className={labelClass}>{labels.socialLinks}</label>
        <div className="space-y-2">
          {SOCIAL_PLATFORMS.map((platform) => (
            <div key={platform} className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400 w-16 shrink-0 capitalize">{platform}</span>
              <input
                type="url"
                value={form.socialLinks[platform] ?? ''}
                onChange={(e) => setSocialLink(platform, e.target.value)}
                placeholder={`https://${platform}.com/...`}
                className={inputClass + ' flex-1'}
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          {saving ? labels.saving : labels.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
