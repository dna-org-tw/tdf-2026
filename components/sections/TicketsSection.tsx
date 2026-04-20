'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent, trackCustomEvent } from '@/components/FacebookPixel';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import FollowModal from '@/components/FollowModal';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { getUserInfo } from '@/lib/userInfo';
import { getVisitorFingerprint } from '@/lib/visitorStorage';

type TicketKey = 'explore' | 'contribute' | 'weekly_backer' | 'backer';

interface TicketTier {
  name: string;
  key: TicketKey;
  originalPrice: number;
  salePrice: number;
  requiresWeekSelection?: boolean;
  color: {
    bg: string;
    text: string;
    border: string;
    badge: string;
  };
}

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const ticketTiers: TicketTier[] = [
  {
    name: 'Explorer',
    key: 'explore',
    originalPrice: 30,
    salePrice: 25,
    color: {
      bg: 'bg-[#10B8D9]/10',
      text: 'text-[#10B8D9]',
      border: 'border-[#10B8D9]/40',
      badge: 'bg-[#10B8D9]',
    },
  },
  {
    name: 'Contributor',
    key: 'contribute',
    originalPrice: 300,
    salePrice: 250,
    color: {
      bg: 'bg-[#00993E]/10',
      text: 'text-[#00993E]',
      border: 'border-[#00993E]/40',
      badge: 'bg-[#00993E]',
    },
  },
  {
    name: 'Backer',
    key: 'backer',
    originalPrice: 600,
    salePrice: 500,
    color: {
      bg: 'bg-[#FFD028]/10',
      text: 'text-[#FFD028]',
      border: 'border-[#FFD028]/40',
      badge: 'bg-[#FFD028]',
    },
  },
];

export default function TicketsSection() {
  const { t, lang } = useTranslation();
  const { executeRecaptcha } = useRecaptcha('subscribe');
  const { executeRecaptcha: executeCheckoutRecaptcha } = useRecaptcha('checkout');
  const [saleStatus, setSaleStatus] = useState<{ closed: boolean; cutoff: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/tickets/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setSaleStatus({ closed: !!d.closed, cutoff: d.cutoff });
      })
      .catch(() => {
        // fail-open: leave saleStatus null so UI stays open (server still blocks)
      });
    return () => {
      alive = false;
    };
  }, []);

  const salesClosed = saleStatus?.closed === true;
  const [cutoffCountdown, setCutoffCountdown] = useState<CountdownTime | null>(null);

  useEffect(() => {
    if (!saleStatus?.cutoff) return;
    const cutoffMs = new Date(saleStatus.cutoff).getTime();
    if (isNaN(cutoffMs)) return;

    const tick = () => {
      const diff = cutoffMs - Date.now();
      if (diff <= 0) {
        setCutoffCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
        return;
      }
      setCutoffCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        total: diff,
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [saleStatus?.cutoff]);

  const [countdown, setCountdown] = useState<CountdownTime | null>(null);
  const [loadingTier, setLoadingTier] = useState<TicketKey | null>(null);
  const [weekModalOpen, setWeekModalOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [pendingWeekTier, setPendingWeekTier] = useState<TicketTier | null>(null);
  const [followerModalOpen, setFollowerModalOpen] = useState(false);
  const [followerEmail, setFollowerEmail] = useState('');
  const [followerSubmitting, setFollowerSubmitting] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultModalType, setResultModalType] = useState<'success' | 'error' | 'duplicate' | null>(null);
  const [resultModalMessage, setResultModalMessage] = useState('');
  useSectionTracking({ sectionId: 'tickets', sectionName: 'Tickets Section', category: 'Tickets' });

  const saleEndDate = '3/31';
  
  // Calculate countdown to February 28, 2026 (end of day UTC)
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      // March 31, 2026 23:59:59 UTC
      const endDate = new Date('2026-03-31T23:59:59Z');
      const difference = endDate.getTime() - now.getTime();
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setCountdown({
          days,
          hours,
          minutes,
          seconds,
          total: difference
        });
      } else {
        setCountdown({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          total: 0
        });
      }
    };
    
    // Calculate immediately
    calculateCountdown();
    
    // Update every second
    const interval = setInterval(calculateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const isOnSale = countdown !== null && countdown.total > 0;

  const handleCheckout = async (tier: TicketTier, week?: string) => {
    // If this tier requires week selection and no week is provided, show modal
    if (tier.requiresWeekSelection && !week) {
      setPendingWeekTier(tier);
      setSelectedWeek(null);
      setWeekModalOpen(true);
      return;
    }

    try {
      setLoadingTier(tier.key);

      const price = isOnSale ? tier.salePrice : tier.originalPrice;

      trackEvent('InitiateCheckout', {
        content_name: `${tier.name} Ticket`,
        content_category: 'Tickets',
        content_ids: [tier.key],
        value: price,
        currency: 'USD',
        num_items: 1,
        location: 'tickets_section',
        checkout_provider: 'stripe',
        tier: tier.key,
        on_sale: isOnSale,
        ...(week ? { week } : {}),
      });

      trackEvent('AddPaymentInfo', {
        content_name: `${tier.name} Ticket`,
        content_category: 'Tickets',
        content_ids: [tier.key],
        value: price,
        currency: 'USD',
        location: 'tickets_section',
        checkout_provider: 'stripe',
        tier: tier.key,
      });

      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeCheckoutRecaptcha();
      } catch (err) {
        console.error('reCAPTCHA execution failed:', err);
        alert('Unable to start checkout. Please try again later or contact us.');
        return;
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: tier.key,
          visitor_fingerprint: getVisitorFingerprint(),
          recaptchaToken,
          ...(week ? { week } : {}),
        }),
      });

      if (!response.ok) {
        console.error('Failed to create checkout session', await response.text());
        alert('Unable to start checkout. Please try again later or contact us.');
        return;
      }

      const data: { url?: string } = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Checkout URL is missing. Please try again later.');
      }
    } catch (error) {
      console.error('Error during checkout', error);
      alert('Unexpected error starting checkout. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  };

  const handleWeekConfirm = () => {
    if (!selectedWeek || !pendingWeekTier) return;
    setWeekModalOpen(false);
    handleCheckout(pendingWeekTier, selectedWeek);
    setPendingWeekTier(null);
  };

  const handleFollowerSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = followerEmail.trim();
    if (!trimmedEmail) {
      setResultModalType('error');
      setResultModalMessage(t.hero.followForm.emptyEmailError);
      setResultModalOpen(true);
      return;
    }
    setFollowerSubmitting(true);
    try {
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch {
        setResultModalType('error');
        setResultModalMessage(t.hero.followForm.recaptchaError);
        setResultModalOpen(true);
        setFollowerSubmitting(false);
        return;
      }
      const userInfo = getUserInfo();
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          source: 'tickets_section_follower',
          recaptchaToken,
          timezone: userInfo.timezone,
          locale: userInfo.locale,
          visitor_fingerprint: getVisitorFingerprint(),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          setResultModalType('duplicate');
          setResultModalMessage(result.error || t.hero.followForm.duplicateMessage);
          setFollowerEmail('');
          setFollowerModalOpen(false);
          setResultModalOpen(true);
          setFollowerSubmitting(false);
          trackCustomEvent('NewsletterSubmitResult', { result: 'duplicate', location: 'tickets_section_follower', email: trimmedEmail });
          return;
        }
        setResultModalType('error');
        setResultModalMessage(result.error || t.hero.followForm.errorMessage);
        setResultModalOpen(true);
        setFollowerSubmitting(false);
        return;
      }
      setResultModalType('success');
      setResultModalMessage(result.message || t.hero.followForm.successMessage);
      setFollowerEmail('');
      setFollowerModalOpen(false);
      setResultModalOpen(true);
      trackEvent('CompleteRegistration', {
        content_name: 'Tickets Follower',
        content_category: 'Newsletter Subscription',
        email: trimmedEmail,
        location: 'tickets_section_follower',
      });
    } catch (err) {
      console.error('Follower subscribe error:', err);
      setResultModalType('error');
      setResultModalMessage(t.hero.followForm.errorMessage);
      setResultModalOpen(true);
    } finally {
      setFollowerSubmitting(false);
    }
  };

  return (
    <section id="tickets" className="bg-gradient-to-r from-[#1E1F1C] via-[#1E1F1C] to-[#1E1F1C] text-white py-20 md:py-28 lg:py-32 transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!salesClosed && cutoffCountdown && cutoffCountdown.total > 0 && saleStatus?.cutoff && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="mb-10 md:mb-12 rounded-2xl border border-red-500/50 bg-gradient-to-br from-red-600/20 via-orange-500/15 to-red-600/20 p-6 md:p-8 text-center"
            role="status"
            aria-live="polite"
          >
            <motion.p
              className="text-[#FF6B47] font-bold text-lg sm:text-xl md:text-2xl uppercase tracking-wider mb-4"
              animate={{
                textShadow: [
                  '0 0 10px rgba(255, 107, 71, 0.4)',
                  '0 0 25px rgba(255, 107, 71, 0.8)',
                  '0 0 10px rgba(255, 107, 71, 0.4)',
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              ⏰ {t.tickets.cutoffTitle ?? 'Ticket sales close in'}
            </motion.p>
            <div className="flex items-center justify-center gap-3 sm:gap-5 md:gap-6">
              {[
                { value: cutoffCountdown.days, label: lang === 'zh' ? '天' : 'Days' },
                { value: cutoffCountdown.hours, label: lang === 'zh' ? '時' : 'Hrs' },
                { value: cutoffCountdown.minutes, label: lang === 'zh' ? '分' : 'Min' },
                { value: cutoffCountdown.seconds, label: lang === 'zh' ? '秒' : 'Sec' },
              ].map((unit, i) => (
                <div key={i} className="flex flex-col items-center min-w-[48px] sm:min-w-[60px] md:min-w-[72px]">
                  <motion.span
                    className="text-3xl sm:text-5xl md:text-6xl font-bold tabular-nums text-white leading-none"
                    animate={
                      cutoffCountdown.total < 3600000
                        ? {
                            textShadow: [
                              '0 0 15px rgba(255, 107, 71, 0.6)',
                              '0 0 35px rgba(255, 107, 71, 0.9)',
                              '0 0 15px rgba(255, 107, 71, 0.6)',
                            ],
                          }
                        : undefined
                    }
                    transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {String(unit.value).padStart(2, '0')}
                  </motion.span>
                  <span className="mt-1 text-[10px] sm:text-xs text-red-200/80 uppercase tracking-widest">
                    {unit.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs sm:text-sm text-red-200/70">
              {t.tickets.cutoffNote ?? 'No purchases after'}{' '}
              {new Date(saleStatus.cutoff).toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US', {
                timeZone: 'Asia/Taipei',
                dateStyle: 'medium',
                timeStyle: 'short',
              })}{' '}
              (Asia/Taipei)
            </p>
          </motion.div>
        )}
        {salesClosed && (
          <div
            className="mb-10 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-center text-sm sm:text-base text-red-100"
            role="status"
          >
            {t.tickets.salesClosed?.banner ??
              'Ticket sales are closed. Please contact registration@taiwandigitalfest.com.'}
            {saleStatus?.cutoff && (
              <div className="mt-1 text-xs text-red-200/70 font-mono">
                cutoff: {new Date(saleStatus.cutoff).toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US', {
                  timeZone: 'Asia/Taipei',
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })} (Asia/Taipei)
              </div>
            )}
          </div>
        )}
        {/* Sale Banner Info - Only show if on sale */}
        {isOnSale && countdown && countdown.total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-center mb-12 md:mb-16 space-y-4"
          >
            <motion.p
              className="text-[#10B8D9] font-bold text-xl sm:text-2xl md:text-3xl"
              animate={{
                textShadow: [
                  "0 0 10px rgba(16, 184, 217, 0.3)",
                  "0 0 25px rgba(16, 184, 217, 0.6)",
                  "0 0 10px rgba(16, 184, 217, 0.3)"
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              {t.tickets.saleBanner}
            </motion.p>
            
            {/* Countdown Info */}
            <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-white/80 text-sm sm:text-base">
                  {t.tickets.saleEnd}
                </span>
                <span className="font-bold text-[#FFD028] text-xl sm:text-2xl md:text-3xl tracking-wide">
                  {saleEndDate}
                </span>
              </div>
              
              <motion.div
                className="flex items-baseline gap-2"
                key={`days-${countdown.days}`}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <motion.span
                  className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#10B8D9] tabular-nums"
                  key={countdown.days}
                  animate={{ 
                    textShadow: countdown.total < 86400000
                      ? [
                          "0 0 20px rgba(16, 184, 217, 0.5)",
                          "0 0 40px rgba(16, 184, 217, 0.8)",
                          "0 0 20px rgba(16, 184, 217, 0.5)"
                        ]
                      : [
                          "0 0 10px rgba(16, 184, 217, 0.3)",
                          "0 0 25px rgba(16, 184, 217, 0.6)",
                          "0 0 10px rgba(16, 184, 217, 0.3)"
                        ]
                  }}
                  transition={{ 
                    duration: 0.2,
                    textShadow: {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }
                  }}
                >
                  {countdown.days}
                </motion.span>
                <span className="text-base sm:text-lg md:text-xl text-[#10B8D9] font-semibold uppercase tracking-wide">
                  {countdown.days === 1 ? 'Day' : 'Days'} Left
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Section Heading */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white text-center mb-10 md:mb-14">
          {t.tickets.title}
        </h2>

        {/* Ticket Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 lg:gap-10 mb-4 md:mb-6 md:items-stretch">
          {ticketTiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative rounded-2xl p-8 border-2 transition-all duration-300
                bg-gradient-to-br from-[#1E1F1C] to-[#1E1F1C]/90 backdrop-blur-sm ${tier.color.border}
                hover:shadow-2xl hover:shadow-[#10B8D9]/20 hover:scale-105 hover:from-[#1E1F1C]/95 hover:to-[#1E1F1C]/85
                flex flex-col h-full
                ${tier.key === 'contribute'
                  ? 'md:scale-105 md:-mt-4 md:z-10 shadow-2xl shadow-[#00993E]/40 border-[#00993E]'
                  : 'md:opacity-90'}
              `}
            >
              {/* Most Popular badge for Contributor - icon with subtle animation */}
              {tier.key === 'contribute' && (
                <motion.div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-white/95 text-[#1E1F1C] shadow-lg border border-white/50"
                  title="Most popular"
                  aria-label="Most popular"
                  animate={{
                    scale: [1, 1.08, 1],
                    boxShadow: [
                      '0 10px 25px -5px rgba(0, 153, 62, 0.2), 0 8px 10px -6px rgba(0, 153, 62, 0.15)',
                      '0 10px 35px -5px rgba(0, 153, 62, 0.35), 0 8px 15px -6px rgba(0, 153, 62, 0.25)',
                      '0 10px 25px -5px rgba(0, 153, 62, 0.2), 0 8px 10px -6px rgba(0, 153, 62, 0.15)',
                    ],
                  }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <motion.svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </motion.svg>
                </motion.div>
              )}

              {/* Content */}
              <div className="mt-4 flex-1 flex flex-col">
                <h3 className="text-2xl font-display font-bold mb-2 text-white">
                  {t.tickets[tier.key].label}
                </h3>
                
                {/* Pricing */}
                <div className="mb-6">
                  {isOnSale && tier.originalPrice !== tier.salePrice ? (
                    <div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-3xl font-bold text-white">
                          ${tier.salePrice}
                        </span>
                        <span className="text-white/70 text-sm">USD</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/50 line-through text-sm">
                          ${tier.originalPrice} USD
                        </span>
                        <span className="text-[#FFD028] text-xs font-medium">
                          {t.tickets.save} ${tier.originalPrice - tier.salePrice}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white">
                        ${tier.originalPrice}
                      </span>
                      <span className="text-[#F6F6F6]/60 text-sm">USD</span>
                    </div>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6 flex-1">
                  {t.tickets[tier.key].features.map((feature, featureIndex) => {
                    // Extract core feature name (remove quantity suffix like " x 1", " x 10+", etc.)
                    const getCoreFeatureName = (f: string) => {
                      // Remove patterns like " x 1", " x 10+", " x 4", etc.
                      return f.replace(/\s*x\s*\d+\+?$/, '').trim();
                    };
                    
                    const currentCore = getCoreFeatureName(feature);
                    
                    // Check if this is Digital Nomad Activities (should not be dimmed)
                    const isDigitalNomadActivities = 
                      currentCore.includes('Digital Nomad Activities') || 
                      currentCore.includes('數位遊牧活動');
                    
                    // Check if this feature exists in previous tier (but exclude Digital Nomad Activities)
                    let isPreviousTierFeature = false;
                    if (!isDigitalNomadActivities) {
                      if (tier.key === 'contribute') {
                        isPreviousTierFeature = t.tickets.explore.features.some(prevFeature => {
                          const prevCore = getCoreFeatureName(prevFeature);
                          return currentCore === prevCore;
                        });
                      } else if (tier.key === 'weekly_backer') {
                        isPreviousTierFeature = t.tickets.contribute.features.some(prevFeature => {
                          const prevCore = getCoreFeatureName(prevFeature);
                          return currentCore === prevCore;
                        });
                      } else if (tier.key === 'backer') {
                        isPreviousTierFeature = t.tickets.contribute.features.some(prevFeature => {
                          const prevCore = getCoreFeatureName(prevFeature);
                          return currentCore === prevCore;
                        });
                      }
                    }
                    
                    // Check if this is a unique feature (not in previous tier)
                    const isUniqueFeature = !isPreviousTierFeature;
                    
                    // Explorer: use white for exclusive community feature
                    const isExplorerWhiteFeature = tier.key === 'explore' && (
                      featureIndex === 0 ||
                      currentCore.includes('Exclusive Digital Nomad Community') ||
                      currentCore.includes('專屬數位遊牧社群')
                    );
                    // Explorer / Contributor / Backer: Opening Marketplace in white, extras (e.g. limited drinks) in tier color
                    const isOpeningMarketplaceFeature =
                      feature.includes('開幕市集') || feature.includes('Opening Marketplace');
                    
                    // Get tier-specific color for unique features
                    const getTierColor = () => {
                      if (isExplorerWhiteFeature) return { icon: 'text-white/70', text: 'text-white' };
                      if (!isUniqueFeature) return { icon: 'text-white/70', text: 'text-white/90' };
                      switch (tier.key) {
                        case 'contribute':
                          return { icon: 'text-[#00993E]', text: 'text-[#00993E] font-semibold' };
                        case 'weekly_backer':
                        case 'backer':
                          return { icon: 'text-[#FFD028]', text: 'text-[#FFD028] font-semibold' };
                        default:
                          return { icon: 'text-[#10B8D9]', text: 'text-[#10B8D9] font-semibold' };
                      }
                    };
                    
                    const colors = getTierColor();
                    // Opening Marketplace row: icon uses tier color
                    const getMarketplaceColor = () => {
                      if (tier.key === 'explore') return 'text-[#10B8D9]';
                      if (tier.key === 'contribute') return 'text-[#00993E]';
                      return 'text-[#FFD028]';
                    };
                    const openingMarketplaceIcon = isOpeningMarketplaceFeature && getMarketplaceColor();
                    const openingMarketplaceRestClass = isOpeningMarketplaceFeature && `${getMarketplaceColor()} font-semibold`;
                    
                    const openingMarketplaceParts = isOpeningMarketplaceFeature && (() => {
                      const sep = feature.includes('＋') ? '＋' : ' + ';
                      const idx = feature.indexOf(sep);
                      if (idx === -1) return null;
                      return { first: feature.slice(0, idx), rest: sep + feature.slice(idx + sep.length) };
                    })();
                    
                    return (
                      <div 
                        key={featureIndex} 
                        className="flex items-start gap-2"
                      >
                        <svg
                          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${openingMarketplaceParts ? openingMarketplaceIcon : colors.icon}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className={`text-sm ${openingMarketplaceParts ? '' : colors.text}`}>
                          {openingMarketplaceParts ? (
                            <>
                              <span className="text-white">{openingMarketplaceParts.first}</span>
                              <span className={openingMarketplaceRestClass || 'text-white/70'}>
                                {openingMarketplaceParts.rest}
                              </span>
                            </>
                          ) : (
                            feature
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Stripe Checkout Button */}
                <button
                  onClick={() => handleCheckout(tier)}
                  disabled={salesClosed || loadingTier === tier.key}
                  className={`
                    w-full mt-auto px-4 py-3 rounded-lg font-semibold text-sm md:text-base
                    ${tier.color.badge} text-white
                    hover:opacity-90
                    disabled:opacity-60 disabled:cursor-not-allowed
                    transition-all duration-200 shadow-md hover:shadow-lg
                  `}
                >
                  {salesClosed
                    ? t.tickets.salesClosed?.button ?? 'Sales closed'
                    : loadingTier === tier.key
                      ? t.tickets?.processing ?? 'Processing...'
                      : t.tickets?.payWithCard ?? 'Pay with card'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Weekly Backer 獨立票券 - 選擇週次 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 }}
          className="w-full mb-4 md:mb-6"
        >
          <div
            className={`
              relative rounded-2xl p-8 border-2 transition-all duration-300
              bg-gradient-to-br from-[#1E1F1C] to-[#1E1F1C]/90 backdrop-blur-sm
              border-[#FFD028]/40 hover:shadow-2xl hover:shadow-[#FFD028]/15 hover:scale-[1.02]
              flex flex-col
            `}
          >
            <div className="flex-1 flex flex-col">
              <h3 className="text-2xl font-display font-bold mb-2 text-white">
                {t.tickets.weekly_backer?.label ?? 'Weekly Backer'}
              </h3>
              <div className="mb-6">
                {isOnSale ? (
                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-bold text-white">$200</span>
                      <span className="text-white/70 text-sm">USD</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 line-through text-sm">$250 USD</span>
                      <span className="text-[#FFD028] text-xs font-medium">{t.tickets.save} $50</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">$250</span>
                    <span className="text-[#F6F6F6]/60 text-sm">USD</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingWeekTier({
                    name: 'Weekly Backer',
                    key: 'weekly_backer',
                    originalPrice: 250,
                    salePrice: 200,
                    requiresWeekSelection: true,
                    color: {
                      bg: 'bg-[#FFD028]/10',
                      text: 'text-[#FFD028]',
                      border: 'border-[#FFD028]/40',
                      badge: 'bg-[#FFD028]',
                    },
                  });
                  setSelectedWeek(null);
                  setWeekModalOpen(true);
                }}
                disabled={salesClosed || loadingTier === 'weekly_backer'}
                className="w-full mt-auto px-4 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#FFD028] text-[#1E1F1C] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {salesClosed
                  ? t.tickets.salesClosed?.button ?? 'Sales closed'
                  : loadingTier === 'weekly_backer'
                    ? (t.tickets?.processing ?? 'Processing...')
                    : (t.tickets?.payWithCard ?? 'Start Your Journey')}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Follower 獨立票券 - 免費訂閱 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="w-full"
        >
          <div
            className={`
              relative rounded-2xl p-8 border-2 transition-all duration-300
              bg-gradient-to-br from-[#1E1F1C] to-[#1E1F1C]/90 backdrop-blur-sm
              border-[#A855F7]/40 hover:shadow-2xl hover:shadow-[#A855F7]/15 hover:scale-[1.02]
              flex flex-col
            `}
          >
            <div className="flex-1 flex flex-col">
              <h3 className="text-2xl font-display font-bold mb-2 text-white">
                {t.tickets.follower?.title ?? 'Follower'}
              </h3>
              {t.tickets.follower?.subtitle && (
                <p className="text-sm text-white/80 mb-3">
                  {t.tickets.follower.subtitle}
                </p>
              )}
              <div className="mb-6">
                <span className="text-2xl font-bold text-[#A855F7]">
                  {t.tickets.follower?.price ?? 'Free'}
                </span>
              </div>
              <div className="space-y-3 mb-6 flex-1">
                {(t.tickets.follower?.features ?? ['Exclusive Digital Nomad Community', 'Digital Nomad Activities x 10+']).map((feature: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#A855F7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-white/90">{feature}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFollowerModalOpen(true)}
                className="w-full mt-auto px-4 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#A855F7] text-white hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {t.tickets.follower?.cta ?? 'Become our follower'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Legal acknowledgement — shown below all ticket cards.
            Marketing consent is captured natively by Stripe next to the
            email field via consent_collection.promotions — see
            app/api/checkout/route.ts. */}
        <p className="mt-8 max-w-3xl mx-auto text-center text-xs text-white/60 leading-relaxed">
          {t.tickets.legalNotice?.line1 ??
            'Ticket sales are processed by Nomad Explore LLC (Wyoming, USA). Event services are operated by Taiwan Digital Nomad Association.'}{' '}
          {t.tickets.legalNotice?.line2 ?? 'By purchasing, you agree to our'}{' '}
          <a href="/terms" className="text-[#10B8D9] underline hover:text-[#10B8D9]/80">
            {t.tickets.legalNotice?.terms ?? 'Terms of Service'}
          </a>{' '}
          {t.tickets.legalNotice?.and ?? 'and'}{' '}
          <a href="/privacy" className="text-[#10B8D9] underline hover:text-[#10B8D9]/80">
            {t.tickets.legalNotice?.privacy ?? 'Privacy Policy'}
          </a>
          {t.tickets.legalNotice?.line3 ??
            ', including refund rules. Festival updates may be emailed to you; every message includes a one-click unsubscribe.'}
        </p>
      </div>

      {/* Email 訂閱 Modal */}
      <AnimatePresence>
        {followerModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setFollowerModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="bg-[#1E1F1C] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-white/10 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                  <h3 className="text-xl font-display font-bold text-white">
                    {t.hero.followForm.title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setFollowerModalOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
                    aria-label={t.followModal?.close ?? 'Close'}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleFollowerSubscribe} className="p-6 space-y-4">
                  <p className="text-sm text-white/80">
                    {t.hero.followForm.description}
                  </p>
                  <input
                    type="email"
                    value={followerEmail}
                    onChange={(e) => setFollowerEmail(e.target.value)}
                    placeholder={t.hero.followForm.emailPlaceholder}
                    disabled={followerSubmitting}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-[#10B8D9] disabled:opacity-50"
                    required
                  />
                  <button
                    type="submit"
                    disabled={followerSubmitting}
                    className="w-full py-3 rounded-xl font-semibold bg-[#10B8D9] text-white hover:opacity-90 disabled:opacity-60 transition-all"
                  >
                    {followerSubmitting ? t.hero.followForm.submitting : t.hero.followForm.submitButton}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Week Selection Modal for Weekly Backer */}
      <AnimatePresence>
        {weekModalOpen && pendingWeekTier && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setWeekModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="bg-[#1E1F1C] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[#FFD028]/30 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                  <h3 className="text-xl font-display font-bold text-white">
                    {t.tickets.weekly_backer?.weekLabel ?? 'Select Your Week'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setWeekModalOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-3">
                  {(t.tickets.weekly_backer?.weeks ?? [
                    'Week 1: May 1 – May 7',
                    'Week 2: May 8 – May 14',
                    'Week 3: May 15 – May 21',
                    'Week 4: May 22 – May 28',
                  ]).map((weekLabel: string, i: number) => {
                    const weekValue = `week${i + 1}`;
                    return (
                      <button
                        key={weekValue}
                        type="button"
                        onClick={() => setSelectedWeek(weekValue)}
                        className={`
                          w-full px-4 py-3 rounded-xl border-2 text-left font-medium transition-all duration-200
                          ${selectedWeek === weekValue
                            ? 'border-[#FFD028] bg-[#FFD028]/15 text-[#FFD028]'
                            : 'border-white/20 bg-white/5 text-white/80 hover:border-[#FFD028]/50 hover:bg-[#FFD028]/5'}
                        `}
                      >
                        {weekLabel}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleWeekConfirm}
                    disabled={!selectedWeek || loadingTier === 'weekly_backer'}
                    className="w-full mt-4 px-4 py-3 rounded-xl font-semibold bg-[#FFD028] text-[#1E1F1C] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    {loadingTier === 'weekly_backer'
                      ? (t.tickets?.processing ?? 'Processing...')
                      : (t.tickets?.payWithCard ?? 'Start Your Journey')}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <FollowModal
        isOpen={resultModalOpen}
        onClose={() => setResultModalOpen(false)}
        type={resultModalType}
        message={resultModalMessage}
      />
    </section>
  );
}
