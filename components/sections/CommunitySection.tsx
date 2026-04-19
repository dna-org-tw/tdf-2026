'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import Link from 'next/link';
import { Mail, CheckCircle2, Zap, Users } from 'lucide-react';
import { TIER_ACCENT, type IdentityTier } from '@/components/member/MemberPassport';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { useNewsletterCount } from '@/hooks/useNewsletterCount';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import { trackEvent, trackCustomEvent } from '@/components/FacebookPixel';
import FollowModal from '@/components/FollowModal';
import { getUserInfo } from '@/lib/userInfo';
import { getVisitorFingerprint } from '@/lib/visitorStorage';
import { pickRandomAnimals, type AnonymousAnimal } from '@/lib/anonymousAnimals';

const ANIMAL_SLOT_COUNT = 6;

function AnimatedCounter({ value, duration = 3500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(0);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      setIsAnimating(true);
      const startValue = prevValueRef.current;
      const endValue = value;
      const startTime = Date.now();

      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 5);
        const currentValue = Math.floor(startValue + (endValue - startValue) * easeOut);
        setDisplayValue(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(endValue);
          setIsAnimating(false);
        }
      };

      requestAnimationFrame(animate);
      prevValueRef.current = value;
    }
  }, [value, duration]);

  return (
    <motion.span
      className="inline-block tabular-nums min-w-[3ch] text-center"
      animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      {displayValue.toLocaleString('en-US')}
    </motion.span>
  );
}

function AnonymousAnimalBadge({ animal, label }: { animal: AnonymousAnimal; label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-2"
      title={`Anonymous ${animal.name}`}
      aria-label={`Anonymous ${animal.name}`}
    >
      <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-white/5 border-2 border-white/10 select-none">
        <span aria-hidden>{animal.emoji}</span>
      </div>
      <div className="text-center min-w-0 max-w-[100px]">
        <p className="text-[13px] font-medium text-white/40 truncate">
          {label}
        </p>
      </div>
    </div>
  );
}

function MoreMembersBadge({ count, label }: { count: number; label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-2"
      aria-label={label}
    >
      <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white/5 border-2 border-dashed border-white/20 select-none">
        <span className="text-sm font-bold text-white/70">+{count}</span>
      </div>
      <div className="text-center min-w-0 max-w-[100px]">
        <p className="text-[13px] font-medium text-white/40 truncate">
          {label}
        </p>
      </div>
    </div>
  );
}

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
  const { t, lang } = useTranslation();
  const { executeRecaptcha } = useRecaptcha('subscribe');
  useSectionTracking({ sectionId: 'community', sectionName: 'Community Section', category: 'Engagement' });

  const [members, setMembers] = useState<PublicMember[]>([]);
  const [total, setTotal] = useState(0);
  const [anonymousCount, setAnonymousCount] = useState(0);
  const [animals, setAnimals] = useState<AnonymousAnimal[]>([]);
  const { count: followerCount, loading: isLoadingCount, increment: incrementFollowerCount } = useNewsletterCount();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'duplicate' | null;
    message: string;
  }>({ isOpen: false, type: null, message: '' });

  const labels = lang === 'zh' ? {
    cta: '查看所有夥伴',
    empty: '成為第一位公開名片的夥伴',
    anonymousLabel: '匿名夥伴',
    moreMembers: '位夥伴',
  } : {
    cta: 'View all members',
    empty: 'Be the first to share your card',
    anonymousLabel: 'Anonymous',
    moreMembers: 'more',
  };

  useEffect(() => {
    fetch('/api/members?page=1')
      .then((r) => r.ok ? r.json() : { members: [], total: 0, anonymousCount: 0 })
      .then((d) => {
        setMembers(d.members ?? []);
        setTotal(d.total ?? 0);
        const anon = d.anonymousCount ?? 0;
        setAnonymousCount(anon);
        setAnimals(pickRandomAnimals(Math.min(ANIMAL_SLOT_COUNT, anon)));
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch {
        setModalState({ isOpen: true, type: 'error', message: t.hero.followForm.recaptchaError });
        setIsSubmitting(false);
        return;
      }

      const userInfo = getUserInfo();
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          source: 'community_section',
          recaptchaToken,
          timezone: userInfo.timezone,
          locale: userInfo.locale,
          visitor_fingerprint: getVisitorFingerprint(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setModalState({ isOpen: true, type: 'success', message: data.message || t.followUs.successMessage });
        setEmail('');
        incrementFollowerCount();
        trackEvent('CompleteRegistration', {
          content_name: 'Community Section Form',
          content_category: 'Newsletter Subscription',
          email: trimmed,
          location: 'community_section',
        });
      } else if (response.status === 409) {
        setModalState({ isOpen: true, type: 'duplicate', message: data.error || t.followUs.duplicateMessage });
        trackCustomEvent('NewsletterSubmitResult', { result: 'duplicate', location: 'community_section', email: trimmed });
      } else {
        setModalState({ isOpen: true, type: 'error', message: data.error || t.followUs.errorMessage });
        trackCustomEvent('NewsletterSubmitResult', { result: 'error', location: 'community_section', email: trimmed });
      }
    } catch {
      setModalState({ isOpen: true, type: 'error', message: t.followUs.errorMessage });
      trackCustomEvent('NewsletterSubmitResult', { result: 'error', location: 'community_section', email: trimmed });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section
        id="community"
        className="relative bg-gradient-to-b from-[#1E1F1C] to-[#0F0F0E] py-20 md:py-28 px-4 sm:px-6 overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#10B8D9] rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#00993E] rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6">
              {t.followUs.title}
            </h2>
            <p className="text-lg sm:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              {t.followUs.subtitle}
            </p>

            {!isLoadingCount && followerCount !== null && followerCount > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="mb-2"
              >
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#10B8D9]/20 to-[#00993E]/20 backdrop-blur-sm px-6 py-3 rounded-full border border-[#10B8D9]/30 shadow-lg">
                  <Users className="w-5 h-5 text-[#10B8D9]" />
                  <span className="text-white/90 text-sm sm:text-base font-medium">
                    <span className="text-white/70">{t.followUs.followerCountPrefix}</span>{' '}
                    <span className="text-[#10B8D9] font-bold text-lg sm:text-xl">
                      <AnimatedCounter value={followerCount} />
                    </span>{' '}
                    <span className="text-white/70">{t.followUs.followerCountSuffix}</span>
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Member grid */}
          {members.length > 0 || animals.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-wrap justify-center gap-8 sm:gap-10 mb-10"
            >
              {members.slice(0, 12).map((m) => (
                <MemberBadge key={m.member_no} member={m} />
              ))}
              {animals.map((a) => (
                <AnonymousAnimalBadge
                  key={a.name}
                  animal={a}
                  label={labels.anonymousLabel}
                />
              ))}
              {anonymousCount > ANIMAL_SLOT_COUNT && (
                <MoreMembersBadge
                  count={anonymousCount - ANIMAL_SLOT_COUNT}
                  label={labels.moreMembers}
                />
              )}
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

          {total > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex justify-center mb-12"
            >
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
            </motion.div>
          )}

          {/* Benefits chips */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10"
            >
              <CheckCircle2 className="w-5 h-5 text-[#10B8D9]" />
              <span className="text-white/90 text-sm sm:text-base font-medium">
                {t.followUs.benefits.free}
              </span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10"
            >
              <Zap className="w-5 h-5 text-[#10B8D9]" />
              <span className="text-white/90 text-sm sm:text-base font-medium">
                {t.followUs.benefits.realTime}
              </span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10"
            >
              <Users className="w-5 h-5 text-[#10B8D9]" />
              <span className="text-white/90 text-sm sm:text-base font-medium">
                {t.followUs.benefits.community}
              </span>
            </motion.div>
          </div>

          {/* Email subscribe form */}
          <div id="follow-us">
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              onSubmit={handleSubmit}
              className="max-w-2xl mx-auto"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative" suppressHydrationWarning>
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    id="follow-us-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.followUs.emailPlaceholder}
                    required
                    className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent transition-all"
                    disabled={isSubmitting}
                    suppressHydrationWarning
                  />
                </div>
                <motion.button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white font-semibold rounded-xl transition-all shadow-lg shadow-[#10B8D9]/40 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isSubmitting ? t.followUs.submitting : t.followUs.submitButton}
                </motion.button>
              </div>
              <p className="text-center text-white/60 text-sm mt-4">
                {t.followUs.privacyNote}
              </p>
            </motion.form>
          </div>
        </div>
      </section>

      <FollowModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        type={modalState.type}
        message={modalState.message}
      />
    </>
  );
}
