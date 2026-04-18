'use client';

import Link from 'next/link';

interface Props {
  isPublic: boolean;
  memberNo: string | null;
  lang: 'en' | 'zh';
  onChange: (next: boolean) => void;
  onSignOut: () => void;
  signOutLabel: string;
}

export default function ProfileVisibility({
  isPublic,
  memberNo,
  lang,
  onChange,
  onSignOut,
  signOutLabel,
}: Props) {
  const copy =
    lang === 'zh'
      ? {
          heading: '公開設定',
          publicLabel: '公開',
          publicDesc: '任何人有連結即可查看你的自介、標籤、社群連結。',
          privateLabel: '私人',
          privateDesc: '只有你能看到這張名片，但現場 QR 仍可感應。',
          preview: '預覽公開頁面 →',
        }
      : {
          heading: 'Profile visibility',
          publicLabel: 'Public',
          publicDesc: 'Anyone with your link can view your bio, tags, and social links.',
          privateLabel: 'Private',
          privateDesc: 'Only you see this card, but your QR still works on-site.',
          preview: 'Preview public card →',
        };

  return (
    <section
      aria-label={copy.heading}
      className="rounded-2xl bg-white/60 border border-stone-200 p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">
          {copy.heading}
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="text-[11px] font-mono tracking-[0.15em] uppercase text-slate-400 hover:text-red-500 transition-colors"
        >
          {signOutLabel}
        </button>
      </div>

      <div
        role="radiogroup"
        aria-label={copy.heading}
        className="grid sm:grid-cols-2 gap-2"
      >
        <VisibilityOption
          selected={isPublic}
          onSelect={() => onChange(true)}
          label={copy.publicLabel}
          description={copy.publicDesc}
        />
        <VisibilityOption
          selected={!isPublic}
          onSelect={() => onChange(false)}
          label={copy.privateLabel}
          description={copy.privateDesc}
        />
      </div>

      {isPublic && memberNo ? (
        <Link
          href={`/members/${memberNo}`}
          className="mt-3 inline-flex items-center gap-1 text-[12px] text-[#10B8D9] hover:underline"
        >
          {copy.preview}
        </Link>
      ) : null}
    </section>
  );
}

function VisibilityOption({
  selected,
  onSelect,
  label,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={
        'text-left rounded-xl border p-3 transition-all ' +
        (selected
          ? 'bg-white border-[#0E0E10] shadow-[0_0_0_2px_rgba(14,14,16,0.08)]'
          : 'bg-white/80 border-stone-200 hover:border-stone-300')
      }
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={
            'w-4 h-4 rounded-full shrink-0 transition-all ' +
            (selected
              ? 'bg-[#0E0E10] ring-2 ring-offset-2 ring-[#0E0E10]/30'
              : 'bg-transparent border-2 border-stone-300')
          }
        />
        <span className="text-sm font-semibold text-slate-900">{label}</span>
      </span>
      <span className="mt-1 block text-[12px] text-slate-500 leading-snug">
        {description}
      </span>
    </button>
  );
}
