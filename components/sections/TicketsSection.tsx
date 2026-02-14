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

interface TicketTier {
  name: string;
  key: 'explore' | 'contribute' | 'backer';
  originalPrice: number;
  salePrice: number;
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
    salePrice: 20,
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
    salePrice: 200,
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
    salePrice: 400,
    color: {
      bg: 'bg-[#FFD028]/10',
      text: 'text-[#FFD028]',
      border: 'border-[#FFD028]/40',
      badge: 'bg-[#FFD028]',
    },
  },
];

export default function TicketsSection() {
  const { t } = useTranslation();
  const { executeRecaptcha } = useRecaptcha('subscribe');
  const [countdown, setCountdown] = useState<CountdownTime | null>(null);
  const [loadingTier, setLoadingTier] = useState<'explore' | 'contribute' | 'backer' | null>(null);
  const [followerModalOpen, setFollowerModalOpen] = useState(false);
  const [followerEmail, setFollowerEmail] = useState('');
  const [followerSubmitting, setFollowerSubmitting] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultModalType, setResultModalType] = useState<'success' | 'error' | 'duplicate' | null>(null);
  const [resultModalMessage, setResultModalMessage] = useState('');
  useSectionTracking({ sectionId: 'tickets', sectionName: 'Tickets Section', category: 'Tickets' });

  const saleEndDate = '2/28';
  
  // Calculate countdown to February 28, 2026 (end of day UTC)
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      // February 28, 2026 23:59:59 UTC
      const endDate = new Date('2026-02-28T23:59:59Z');
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

  const handleCheckout = async (tier: TicketTier) => {
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

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier: tier.key, visitor_fingerprint: getVisitorFingerprint() }),
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
                  {isOnSale ? (
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
                        // Check if feature exists in explore
                        isPreviousTierFeature = t.tickets.explore.features.some(prevFeature => {
                          const prevCore = getCoreFeatureName(prevFeature);
                          return currentCore === prevCore;
                        });
                      } else if (tier.key === 'backer') {
                        // Check if feature exists in contribute
                        isPreviousTierFeature = t.tickets.contribute.features.some(prevFeature => {
                          const prevCore = getCoreFeatureName(prevFeature);
                          return currentCore === prevCore;
                        });
                      }
                    }
                    
                    // Check if this is a unique feature (not in previous tier)
                    const isUniqueFeature = !isPreviousTierFeature;
                    
                    // Explorer: 專屬社群用白色
                    const isExplorerWhiteFeature = tier.key === 'explore' && (
                      featureIndex === 0 ||
                      currentCore.includes('Exclusive Digital Nomad Community') ||
                      currentCore.includes('專屬數位遊牧社群')
                    );
                    // Explorer / Contributor / Backer：開幕市集白字，後面（＋有限酒水等）用票券等級色
                    const isOpeningMarketplaceFeature =
                      feature.includes('開幕市集') || feature.includes('Opening Marketplace');
                    
                    // Get tier-specific color for unique features
                    const getTierColor = () => {
                      if (isExplorerWhiteFeature) return { icon: 'text-white/70', text: 'text-white' };
                      if (!isUniqueFeature) return { icon: 'text-white/70', text: 'text-white/90' };
                      switch (tier.key) {
                        case 'contribute':
                          return { icon: 'text-[#00993E]', text: 'text-[#00993E] font-semibold' };
                        case 'backer':
                          return { icon: 'text-[#FFD028]', text: 'text-[#FFD028] font-semibold' };
                        default:
                          return { icon: 'text-[#10B8D9]', text: 'text-[#10B8D9] font-semibold' };
                      }
                    };
                    
                    const colors = getTierColor();
                    // 開幕市集那行：icon 用票券等級色
                    const openingMarketplaceIcon =
                      isOpeningMarketplaceFeature &&
                      (tier.key === 'explore'
                        ? 'text-[#10B8D9]'
                        : tier.key === 'contribute'
                          ? 'text-[#00993E]'
                          : 'text-[#FFD028]');
                    const openingMarketplaceRestClass =
                      isOpeningMarketplaceFeature &&
                      (tier.key === 'explore'
                        ? 'text-[#10B8D9] font-semibold'
                        : tier.key === 'contribute'
                          ? 'text-[#00993E] font-semibold'
                          : 'text-[#FFD028] font-semibold');
                    
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
                  disabled={loadingTier === tier.key}
                  className={`
                    w-full mt-auto px-4 py-3 rounded-lg font-semibold text-sm md:text-base
                    ${tier.color.badge} text-white
                    hover:opacity-90
                    disabled:opacity-60 disabled:cursor-not-allowed
                    transition-all duration-200 shadow-md hover:shadow-lg
                  `}
                >
                  {loadingTier === tier.key
                    ? t.tickets?.processing ?? 'Processing...'
                    : t.tickets?.payWithCard ?? 'Pay with card'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

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
              border-white/30 hover:shadow-2xl hover:shadow-[#10B8D9]/15 hover:scale-[1.02]
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
                <span className="text-2xl font-bold text-[#10B8D9]">
                  {t.tickets.follower?.price ?? 'Free'}
                </span>
              </div>
              <div className="space-y-3 mb-6 flex-1">
                {(t.tickets.follower?.features ?? ['Exclusive Digital Nomad Community', 'Digital Nomad Activities x 10+']).map((feature: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#10B8D9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-white/90">{feature}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFollowerModalOpen(true)}
                className="w-full mt-auto px-4 py-3 rounded-lg font-semibold text-sm md:text-base bg-[#10B8D9] text-white hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {t.tickets.follower?.cta ?? 'Become our follower'}
              </button>
            </div>
          </div>
        </motion.div>
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

      <FollowModal
        isOpen={resultModalOpen}
        onClose={() => setResultModalOpen(false)}
        type={resultModalType}
        message={resultModalMessage}
      />
    </section>
  );
}
