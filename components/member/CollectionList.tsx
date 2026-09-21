'use client';

import Link from 'next/link';
import { TIER_ACCENT, type IdentityTier } from './MemberPassport';
import type { CollectionEntry } from '@/lib/memberCollections';

interface CollectionListProps {
  entries: CollectionEntry[];
  mode: 'collected' | 'collectors';
  labels: {
    remove: string;
    removeConfirm: string;
    newBadge: string;
    empty: string;
  };
  onRemove?: (memberNo: string) => void;
}

export default function CollectionList({ entries, mode, labels, onRemove }: CollectionListProps) {
  if (entries.length === 0) {
    return (
      <p className="text-center text-slate-400 text-sm py-8">{labels.empty}</p>
    );
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => {
        const tier = (entry.tier || 'follower') as IdentityTier;
        const accent = TIER_ACCENT[tier] || TIER_ACCENT.follower;
        const initials = entry.display_name
          ? entry.display_name.trim().slice(0, 2).toUpperCase()
          : (entry.member_no || '??').slice(-2);
        const highlight = mode === 'collectors' && entry.is_unread;
        return (
          <li
            key={entry.member_no}
            className={`relative bg-white rounded-xl border p-4 transition-colors ${
              highlight ? 'border-[#10B8D9] bg-cyan-50/30' : 'border-slate-200'
            }`}
          >
            <Link
              href={`/members/${entry.member_no}`}
              className="flex items-start gap-3 group"
            >
              {entry.avatar_url ? (
                <img
                  src={entry.avatar_url}
                  alt={entry.display_name || ''}
                  className="w-12 h-12 rounded-full object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold shrink-0 text-sm"
                  style={{ backgroundColor: `${accent}20`, color: accent }}
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-[#10B8D9] transition-colors">
                    {entry.display_name || entry.member_no}
                  </p>
                  {highlight && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#10B8D9] text-white shrink-0">
                      {labels.newBadge}
                    </span>
                  )}
                </div>
                {entry.location && (
                  <p className="text-[12px] text-slate-500 truncate">{entry.location}</p>
                )}
                {entry.bio && (
                  <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{entry.bio}</p>
                )}
              </div>
            </Link>

            {mode === 'collected' && onRemove && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(labels.removeConfirm)) onRemove(entry.member_no);
                }}
                className="absolute top-2 right-2 text-[11px] text-slate-400 hover:text-red-500 transition-colors"
              >
                {labels.remove}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
