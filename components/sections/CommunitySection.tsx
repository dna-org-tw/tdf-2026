'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import Link from 'next/link';
import { TIER_ACCENT, type IdentityTier } from '@/components/member/MemberPassport';

interface PublicMember {
  member_no: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  tags: string[];
  tier: string;
}

function MemberBadge({ member }: { member: PublicMember }) {
  const tier = (member.tier || 'follower') as IdentityTier;
  const accent = TIER_ACCENT[tier] || TIER_ACCENT.follower;
  const initials = member.display_name
    ? member.display_name.trim().slice(0, 2).toUpperCase()
    : '??';

  return (
    <Link
      href={`/members/${member.member_no}`}
      className="flex flex-col items-center gap-2 group"
    >
      {member.avatar_url ? (
        <img
          src={member.avatar_url}
          alt={member.display_name || ''}
          className="w-16 h-16 rounded-full object-cover border-2 border-white/10 group-hover:border-white/30 transition-colors"
        />
      ) : (
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-sm border-2 border-white/10 group-hover:border-white/30 transition-colors"
          style={{ backgroundColor: `${accent}25`, color: accent }}
        >
          {initials}
        </div>
      )}
      <div className="text-center min-w-0 max-w-[100px]">
        <p className="text-[13px] font-medium text-white truncate group-hover:text-[#10B8D9] transition-colors">
          {member.display_name || member.member_no}
        </p>
        {member.location && (
          <p className="text-[11px] text-white/50 truncate">{member.location}</p>
        )}
      </div>
    </Link>
  );
}

export default function CommunitySection() {
  const { lang } = useTranslation();
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [total, setTotal] = useState(0);

  const labels = lang === 'zh' ? {
    title: '社群夥伴',
    subtitle: '來自世界各地的數位遊牧者，即將在台灣相聚',
    cta: '查看所有夥伴',
    join: '加入我們',
    empty: '成為第一位公開名片的夥伴',
  } : {
    title: 'Community',
    subtitle: 'Digital nomads from around the world, coming together in Taiwan',
    cta: 'View all members',
    join: 'Join us',
    empty: 'Be the first to share your card',
  };

  useEffect(() => {
    fetch('/api/members?page=1')
      .then((r) => r.ok ? r.json() : { members: [], total: 0 })
      .then((d) => {
        setMembers(d.members ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {});
  }, []);

  return (
    <section id="community" className="relative bg-[#1E1F1C] py-20 sm:py-28 overflow-hidden">
      {/* Subtle glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(16,184,217,0.08), transparent 60%)',
        }}
      />

      <div className="container mx-auto px-6 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
            {labels.title}
          </h2>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            {labels.subtitle}
          </p>
        </motion.div>

        {/* Member grid */}
        {members.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-8 sm:gap-10 mb-12"
          >
            {members.slice(0, 12).map((m) => (
              <MemberBadge key={m.member_no} member={m} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center py-12 mb-8"
          >
            <p className="text-white/40 text-sm">{labels.empty}</p>
          </motion.div>
        )}

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {total > 0 && (
            <Link
              href="/members"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 transition-colors text-sm"
            >
              {labels.cta}
              {total > 12 && (
                <span className="text-[#10B8D9] text-[12px]">+{total - 12}</span>
              )}
              <span aria-hidden>→</span>
            </Link>
          )}
          <Link
            href="/#tickets"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#10B8D9] text-white font-semibold hover:bg-[#0EA5C4] transition-colors text-sm"
          >
            {labels.join}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
