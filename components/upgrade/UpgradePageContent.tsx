'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TierCard from './TierCard';
import type { Order } from '@/lib/types/order';
import { TICKET_TIER_RANK, TICKET_TIERS, type TicketTier } from '@/lib/members';
import { isOnSale, getPricingByKey } from '@/lib/ticketPricing';
import { TIER_NAMES, TIER_ACCENT } from '@/components/member/MemberPassport';
import Link from 'next/link';

function computePriceDiff(from: TicketTier, to: TicketTier): number {
  const fromP = getPricingByKey(from);
  const toP = getPricingByKey(to);
  if (!fromP || !toP) return 0;
  const sale = isOnSale();
  const fromPrice = sale ? fromP.salePrice : fromP.originalPrice;
  const toPrice = sale ? toP.salePrice : toP.originalPrice;
  return toPrice - fromPrice;
}

function getBenefitKey(from: TicketTier, to: TicketTier): string {
  return `${from}_to_${to}`;
}

export default function UpgradePageContent() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingTier, setProcessingTier] = useState<TicketTier | null>(null);
  const [error, setError] = useState('');
  const [salesClosed, setSalesClosed] = useState(false);
  const [saleCutoff, setSaleCutoff] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/tickets/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) {
          setSalesClosed(!!d.closed);
          setSaleCutoff(d.cutoff ?? null);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const upgrade = (t as Record<string, unknown>).upgrade as Record<string, unknown> | undefined;

  useEffect(() => {
    if (authLoading) return;
    if (!user?.email) {
      setLoading(false);
      return;
    }
    fetch(`/api/auth/orders?email=${encodeURIComponent(user.email)}`)
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [user?.email, authLoading]);

  const eligibleOrder = useMemo(() => {
    const paid = orders.filter(
      (o) => (o.status === 'paid' || o.status === 'partially_refunded') && !o.parent_order_id,
    );
    if (paid.length === 0) return null;
    return paid.reduce((best, o) =>
      TICKET_TIER_RANK[o.ticket_tier] > TICKET_TIER_RANK[best.ticket_tier] ? o : best,
    );
  }, [orders]);

  const currentTier = eligibleOrder?.ticket_tier ?? null;

  const upgradeTiers = useMemo(() => {
    if (!currentTier) return [];
    return TICKET_TIERS.filter((t) => TICKET_TIER_RANK[t] > TICKET_TIER_RANK[currentTier]);
  }, [currentTier]);

  const handleUpgrade = async (targetTier: TicketTier) => {
    if (!eligibleOrder || processingTier) return;
    setProcessingTier(targetTier);
    setError('');
    try {
      const res = await fetch('/api/member/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: eligibleOrder.id, target_tier: targetTier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (upgrade?.errorGeneric as string) || 'Error');
        return;
      }
      if (data.hosted_invoice_url) {
        window.location.href = data.hosted_invoice_url;
      }
    } catch {
      setError((upgrade?.errorGeneric as string) || 'Error');
    } finally {
      setProcessingTier(null);
    }
  };

  // Not logged in
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <main className="pt-24 pb-16 px-4 sm:px-6 max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">
            {(upgrade?.loginRequired as string) || 'Please sign in first.'}
          </h1>
          <Link
            href={`/me?lang=${lang}`}
            className="inline-block bg-[#10B8D9] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#0EA5C4] transition-colors"
          >
            {(upgrade?.loginCta as string) || 'Go to Member Page'}
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  // Loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <main className="pt-24 pb-16 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </main>
        <Footer />
      </div>
    );
  }

  // No eligible order or already at max
  if (!eligibleOrder || !currentTier || upgradeTiers.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <main className="pt-24 pb-16 px-4 sm:px-6 max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">
            {eligibleOrder
              ? (upgrade?.alreadyMaxTier as string) || "You're at the highest tier!"
              : (upgrade?.noEligibleOrder as string) || 'No eligible order found.'}
          </h1>
          <Link
            href={`/me?lang=${lang}`}
            className="inline-block text-[#10B8D9] hover:underline font-medium"
          >
            &larr; {(upgrade?.loginCta as string) || 'Back to Member Page'}
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  if (salesClosed) {
    return (
      <section className="min-h-screen bg-stone-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-20">
          <div className="rounded-2xl border border-red-300 bg-red-50 p-8 text-center">
            <h1 className="text-2xl font-display font-bold text-red-900 mb-3">
              {lang === 'zh' ? '升級通道已關閉' : 'Upgrades closed'}
            </h1>
            <p className="text-sm text-red-800">
              {t.tickets?.salesClosed?.banner ??
                'Ticket sales are closed. Please contact registration@taiwandigitalfest.com.'}
            </p>
            {saleCutoff && (
              <p className="mt-2 text-xs font-mono text-red-700/70">
                cutoff: {new Date(saleCutoff).toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US', {
                  timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short',
                })} (Asia/Taipei)
              </p>
            )}
          </div>
        </div>
        <Footer />
      </section>
    );
  }

  const benefits = (upgrade?.benefits ?? {}) as Record<
    string,
    { headline: string; pitch: string; highlights: string[] }
  >;
  const currentTierName = TIER_NAMES[currentTier]?.[lang] ?? currentTier;
  const currentAccent = TIER_ACCENT[currentTier];

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-3">
            {(upgrade?.title as string) || 'Upgrade Your Experience'}
          </h1>
          <p className="text-slate-500 max-w-lg mx-auto">
            {(upgrade?.subtitle as string) || 'Unlock the full festival with an upgrade.'}
          </p>
        </div>
        <div className="text-center mb-8">
          <span className="text-[11px] font-mono tracking-[0.25em] uppercase text-slate-400">
            {(upgrade?.currentTier as string) || 'Your Current Tier'}
          </span>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentAccent }} />
            <span className="font-display font-bold text-lg text-slate-900 uppercase">{currentTierName}</span>
          </div>
        </div>
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 text-red-700 text-sm text-center">{error}</div>
        )}
        <div className="space-y-6">
          {upgradeTiers.map((tier) => {
            const key = getBenefitKey(currentTier, tier);
            const benefit = benefits[key];
            const priceDiff = computePriceDiff(currentTier, tier);
            return (
              <TierCard
                key={tier}
                tier={tier}
                headline={benefit?.headline ?? `Upgrade to ${TIER_NAMES[tier]?.en ?? tier}`}
                pitch={benefit?.pitch ?? ''}
                highlights={benefit?.highlights ?? []}
                priceDiff={priceDiff}
                lang={lang}
                upgradeLabel={(upgrade?.upgradeTo as string) || 'Upgrade to'}
                priceDiffLabel={(upgrade?.priceDifference as string) || 'Pay the difference'}
                ctaLabel={
                  processingTier === tier
                    ? (upgrade?.processing as string) || 'Processing...'
                    : (upgrade?.ctaUpgrade as string) || 'Upgrade Now'
                }
                processing={processingTier === tier}
                onUpgrade={() => handleUpgrade(tier)}
              />
            );
          })}
        </div>
        <div className="mt-10 text-center">
          <Link
            href={`/me?lang=${lang}`}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            &larr; {lang === 'zh' ? '返回會員頁面' : 'Back to member page'}
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
