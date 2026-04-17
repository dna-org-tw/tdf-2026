'use client';

import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import Link from 'next/link';
import { X, CheckCircle2, AlertCircle, Info, Mail } from 'lucide-react';
import { TIER_ACCENT, type IdentityTier } from '@/components/member/MemberPassport';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { getUserInfo } from '@/lib/userInfo';
import { getVisitorFingerprint } from '@/lib/visitorStorage';
import { pickRandomAnimals, type AnonymousAnimal } from '@/lib/anonymousAnimals';

const ANIMAL_SLOT_COUNT = 6;

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
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [total, setTotal] = useState(0);
  const [anonymousCount, setAnonymousCount] = useState(0);
  const [animals, setAnimals] = useState<AnonymousAnimal[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<'success' | 'duplicate' | 'error' | null>(null);
  const [resultMsg, setResultMsg] = useState('');

  const labels = lang === 'zh' ? {
    title: '社群夥伴',
    subtitle: '來自世界各地的數位遊牧者，即將在台灣相聚',
    cta: '查看所有夥伴',
    join: '加入我們',
    empty: '成為第一位公開名片的夥伴',
    anonymousLabel: '匿名夥伴',
    moreMembers: '位夥伴',
    modalTitle: '加入我們的社群',
    modalDesc: '訂閱電子報，獲取最新活動資訊與社群動態',
    emailPlaceholder: '請輸入電子郵件',
    submit: '訂閱',
    submitting: '訂閱中...',
    successTitle: '訂閱成功',
    duplicateTitle: '已經訂閱',
    errorTitle: '發生錯誤',
    tryAgain: '重試',
    whatsapp: '加入專屬數位遊牧社群',
  } : {
    title: 'Community',
    subtitle: 'Digital nomads from around the world, coming together in Taiwan',
    cta: 'View all members',
    join: 'Join us',
    empty: 'Be the first to share your card',
    anonymousLabel: 'Anonymous',
    moreMembers: 'more',
    modalTitle: 'Join Our Community',
    modalDesc: 'Subscribe to our newsletter for the latest events and community updates',
    emailPlaceholder: 'Enter your email',
    submit: 'Subscribe',
    submitting: 'Subscribing...',
    successTitle: 'Subscribed!',
    duplicateTitle: 'Already Subscribed',
    errorTitle: 'Error',
    tryAgain: 'Try Again',
    whatsapp: 'Join our exclusive Digital Nomad community',
  };

  const openModal = () => {
    setShowModal(true);
    setResult(null);
    setResultMsg('');
    setEmail('');
  };

  const closeModal = () => setShowModal(false);

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
        setResult('error');
        setResultMsg(t.hero.followForm.recaptchaError);
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

      if (!response.ok) {
        if (response.status === 409) {
          setResult('duplicate');
          setResultMsg(data.error || t.hero.followForm.duplicateMessage);
          return;
        }
        setResult('error');
        setResultMsg(data.error || t.hero.followForm.errorMessage);
        return;
      }

      setResult('success');
      setResultMsg(data.message || t.hero.followForm.successMessage);
    } catch {
      setResult('error');
      setResultMsg(t.hero.followForm.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
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
        {members.length > 0 || animals.length > 0 ? (
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
          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#10B8D9] text-white font-semibold hover:bg-[#0EA5C4] transition-colors text-sm"
          >
            {labels.join}
          </button>
        </motion.div>
      </div>

      {/* Join modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#1E1F1C] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                  <h3 className="text-2xl font-display font-bold text-white">
                    {result === 'success' ? labels.successTitle : result === 'duplicate' ? labels.duplicateTitle : result === 'error' ? labels.errorTitle : labels.modalTitle}
                  </h3>
                  <button
                    onClick={closeModal}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  {result ? (
                    <div className="text-center">
                      <div className="flex justify-center mb-4">
                        {result === 'success' && <CheckCircle2 className="w-16 h-16 text-[#10B8D9]" />}
                        {result === 'duplicate' && <Info className="w-16 h-16 text-[#10B8D9]" />}
                        {result === 'error' && <AlertCircle className="w-16 h-16 text-red-500" />}
                      </div>
                      <p className="text-base text-white/90 leading-relaxed mb-4">{resultMsg}</p>
                      {(result === 'success' || result === 'duplicate') && (
                        <a
                          href="https://chat.whatsapp.com/KZsFo7oNvZVCPIF86imk0E"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-4 w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#25D366]/90 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-[#25D366]/40"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          <span>{labels.whatsapp}</span>
                        </a>
                      )}
                      {result === 'error' && (
                        <button
                          onClick={() => { setResult(null); setResultMsg(''); }}
                          className="w-full bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-[#10B8D9]/40"
                        >
                          {labels.tryAgain}
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-base text-white/90 leading-relaxed mb-6 text-center">
                        {labels.modalDesc}
                      </p>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={labels.emailPlaceholder}
                            required
                            className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent transition-all"
                            disabled={isSubmitting}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isSubmitting || !email.trim()}
                          className="w-full bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-[#10B8D9]/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? labels.submitting : labels.submit}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
