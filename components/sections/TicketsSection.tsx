'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent, trackCustomEvent } from '@/components/FacebookPixel';
import { useSectionTracking } from '@/hooks/useSectionTracking';

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
  const [countdown, setCountdown] = useState<CountdownTime | null>(null);
  const [loadingTier, setLoadingTier] = useState<'explore' | 'contribute' | 'backer' | null>(null);
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
        value: price,
        currency: 'USD',
      });

      trackCustomEvent('StripeCheckoutClick', {
        location: 'tickets_section',
        tier: tier.key,
        price,
        on_sale: isOnSale,
      });

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier: tier.key }),
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 lg:gap-10 mb-12 md:mb-16">
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
              `}
            >
              {/* Badge */}
              <div className={`absolute top-4 right-4 ${tier.color.badge} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                {tier.name}
              </div>

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
                    
                    // Get tier-specific color for unique features
                    const getTierColor = () => {
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
                    
                    return (
                      <div 
                        key={featureIndex} 
                        className="flex items-start gap-2"
                      >
                        <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className={`text-sm ${colors.text}`}>
                          {feature}
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
      </div>
    </section>
  );
}
