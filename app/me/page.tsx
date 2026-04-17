'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import type { Order } from '@/lib/types/order';
import { TICKET_TIER_RANK } from '@/lib/members';
import { FESTIVAL_START, getValidityPeriod } from '@/lib/ticketPricing';
import type { Registration } from '@/lib/lumaSyncTypes';
import EmailPreferences from '@/components/member/EmailPreferences';
import MemberPassport, { type IdentityTier, type MemberProfile } from '@/components/member/MemberPassport';
import UpcomingEvents from '@/components/member/UpcomingEvents';
import CollapsibleSection from '@/components/member/CollapsibleSection';
import TransferOrderModal from '@/components/order/TransferOrderModal';

const EMPTY_PROFILE: MemberProfile = {
  displayName: null,
  bio: null,
  avatarUrl: null,
  location: null,
  timezone: null,
  tags: [],
  languages: [],
  socialLinks: {},
  isPublic: false,
};

function LoginForm() {
  const { t } = useTranslation();
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          const mins = Math.max(1, Math.ceil((Number(data.retryAfter) || 60) / 60));
          setError(t.auth.rateLimitedMessage.replace('{minutes}', String(mins)));
          return;
        }
        throw new Error(data.error || 'Failed');
      }

      setStep('code');
      setCode('');
    } catch {
      setError(t.auth.errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setVerifying(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });

      if (!res.ok) {
        throw new Error('Invalid code');
      }

      await refreshSession();
    } catch {
      setError(t.auth.invalidCode);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          const mins = Math.max(1, Math.ceil((Number(data.retryAfter) || 60) / 60));
          setError(t.auth.rateLimitedMessage.replace('{minutes}', String(mins)));
          return;
        }
        throw new Error();
      }
      setCode('');
    } catch {
      setError(t.auth.errorMessage);
    } finally {
      setSending(false);
    }
  };

  if (step === 'code') {
    return (
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center">{t.auth.codeSentTitle}</h1>
        <p className="text-slate-600 mb-8 text-center">{t.auth.codeSentMessage}</p>

        <form onSubmit={handleVerifyCode} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t.auth.codePlaceholder}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent text-slate-900 text-center text-2xl tracking-[0.3em] font-mono"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {verifying ? t.auth.verifying : t.auth.verifyCode}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={handleResend}
            disabled={sending}
            className="text-sm text-[#10B8D9] hover:underline disabled:opacity-50"
          >
            {sending ? t.auth.sending : t.auth.resendCode}
          </button>
        </div>
        <div className="mt-2 text-center">
          <button
            onClick={() => { setStep('email'); setError(''); setCode(''); }}
            className="text-sm text-slate-500 hover:underline"
          >
            {email}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center">{t.auth.loginTitle}</h1>
      <p className="text-slate-600 mb-8 text-center">{t.auth.loginDescription}</p>

      <form onSubmit={handleSendCode} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.auth.emailPlaceholder}
          required
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent text-slate-900"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {sending ? t.auth.sending : t.auth.sendCode}
        </button>
      </form>
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: ReturnType<typeof useTranslation>['t'] }) {
  const statusMap: Record<string, { label: string; color: string }> = {
    paid: { label: t.auth.statusPaid, color: 'bg-green-100 text-green-700' },
    pending: { label: t.auth.statusPending, color: 'bg-yellow-100 text-yellow-700' },
    failed: { label: t.auth.statusFailed, color: 'bg-red-100 text-red-700' },
    cancelled: { label: t.auth.statusCancelled, color: 'bg-slate-100 text-slate-600' },
    refunded: { label: t.auth.statusRefunded, color: 'bg-purple-100 text-purple-700' },
  };
  const { label, color } = statusMap[status] || { label: status, color: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2 py-[2px] rounded-full text-[10px] font-medium ${color}`}>{label}</span>;
}

function MemberDashboard() {
  const { user, signOut } = useAuth();
  const { t, lang } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [transferDeadline, setTransferDeadline] = useState<string | null>(null);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [outgoingTransfers, setOutgoingTransfers] = useState<Array<{
    id: string;
    order_id: string;
    to_email: string;
    initiated_by: 'user' | 'admin';
    transferred_at: string;
    ticket_tier: string | null;
    amount_total: number | null;
    currency: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [lumaRegs, setLumaRegs] = useState<Registration[]>([]);
  const [noShowConsumedCount, setNoShowConsumedCount] = useState(0);
  const [me, setMe] = useState<{ memberNo: string | null; firstSeenAt: string | null } | null>(null);
  const [profile, setProfile] = useState<MemberProfile>(EMPTY_PROFILE);
  const [transferTarget, setTransferTarget] = useState<{ parent: Order; hasChildren: boolean } | null>(null);
  const [transferToast, setTransferToast] = useState('');
  const [collectionsUnread, setCollectionsUnread] = useState(0);

  const reloadOrders = () => {
    if (!user?.email) return;
    fetch(`/api/auth/orders?email=${encodeURIComponent(user.email)}`)
      .then((r) => (r.ok ? r.json() : { orders: [], transfer_deadline: null, deadline_passed: false, outgoing_transfers: [] }))
      .then((d) => {
        setOrders(d.orders ?? []);
        setTransferDeadline(d.transfer_deadline ?? null);
        setDeadlinePassed(!!d.deadline_passed);
        setOutgoingTransfers(d.outgoing_transfers ?? []);
      })
      .catch((err) => console.error('[Member] Failed to fetch orders:', err));
  };


  useEffect(() => {
    if (!user?.email) return;

    fetch(`/api/auth/orders?email=${encodeURIComponent(user.email)}`)
      .then((r) => r.ok ? r.json() : { orders: [], transfer_deadline: null, deadline_passed: false, outgoing_transfers: [] })
      .then((d) => {
        setOrders(d.orders ?? []);
        setTransferDeadline(d.transfer_deadline ?? null);
        setDeadlinePassed(!!d.deadline_passed);
        setOutgoingTransfers(d.outgoing_transfers ?? []);
      })
      .catch((err) => console.error('[Member] Failed to fetch orders:', err))
      .finally(() => setLoading(false));

    fetch('/api/auth/luma-registrations')
      .then((r) => r.ok ? r.json() : { registrations: [] })
      .then((d) => {
        setLumaRegs(d.registrations ?? []);
        setNoShowConsumedCount(d.noShowConsumedCount ?? 0);
      })
      .catch(() => setLumaRegs([]));

    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setMe({ memberNo: d.memberNo, firstSeenAt: d.firstSeenAt }))
      .catch(() => {});

    fetch('/api/member/profile')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setProfile({
            displayName: d.display_name ?? null,
            bio: d.bio ?? null,
            avatarUrl: d.avatar_url ?? null,
            location: d.location ?? null,
            timezone: d.timezone ?? null,
            tags: d.tags ?? [],
            languages: d.languages ?? [],
            socialLinks: d.social_links ?? {},
            isPublic: d.is_public ?? false,
          });
        }
      })
      .catch(() => {});

    fetch('/api/member/collections')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setCollectionsUnread(d.unreadCount ?? 0))
      .catch(() => {});
  }, [user?.email]);

  const resolveValidity = (order: Order) => {
    if (order.valid_from && order.valid_until) {
      return { validFrom: order.valid_from, validUntil: order.valid_until };
    }
    const fallback = getValidityPeriod(order.ticket_tier);
    return { validFrom: fallback.valid_from, validUntil: fallback.valid_until };
  };

  const { identityTier, validFrom, validUntil } = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === 'paid');
    if (paidOrders.length === 0) return { identityTier: 'follower' as IdentityTier, validFrom: null, validUntil: null };

    const today = new Date().toISOString().slice(0, 10);
    const festivalStarted = today >= FESTIVAL_START;

    if (festivalStarted) {
      const activeOrders = paidOrders.filter((o) => {
        const { validFrom: vf, validUntil: vu } = resolveValidity(o);
        return today >= vf && today <= vu;
      });
      if (activeOrders.length === 0) {
        const best = paidOrders.reduce<Order>((a, b) =>
          TICKET_TIER_RANK[b.ticket_tier] > TICKET_TIER_RANK[a.ticket_tier] ? b : a, paidOrders[0]);
        const v = resolveValidity(best);
        return { identityTier: best.ticket_tier as IdentityTier, ...v };
      }
      const best = activeOrders.reduce<Order>((a, b) =>
        TICKET_TIER_RANK[b.ticket_tier] > TICKET_TIER_RANK[a.ticket_tier] ? b : a, activeOrders[0]);
      const v = resolveValidity(best);
      return { identityTier: best.ticket_tier as IdentityTier, ...v };
    }

    const best = paidOrders.reduce<Order>((a, b) =>
      TICKET_TIER_RANK[b.ticket_tier] > TICKET_TIER_RANK[a.ticket_tier] ? b : a, paidOrders[0]);
    const v = resolveValidity(best);
    return { identityTier: best.ticket_tier as IdentityTier, ...v };
  }, [orders]);

  const handleTogglePublic = useCallback(async (isPublic: boolean) => {
    setProfile((p) => ({ ...p, isPublic }));
    await fetch('/api/member/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: isPublic }),
    }).catch(() => setProfile((p) => ({ ...p, isPublic: !isPublic })));
  }, []);

  const formatAmount = (amount: number, currency: string) =>
    `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

  const orderGroups = useMemo(() => {
    const parents = orders.filter((o) => !o.parent_order_id);
    const childrenByParent = new Map<string, Order[]>();
    for (const c of orders.filter((o) => o.parent_order_id)) {
      const key = c.parent_order_id as string;
      const arr = childrenByParent.get(key) ?? [];
      arr.push(c);
      childrenByParent.set(key, arr);
    }
    return parents.map((parent) => {
      const children = (childrenByParent.get(parent.id) ?? []).sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
      // Effective display = latest paid order in the group (child takes over after upgrade).
      // Falls back to parent if no paid child yet.
      const paidChildren = children.filter((c) => c.status === 'paid');
      const effective = paidChildren.length > 0
        ? paidChildren.reduce((latest, c) =>
            c.created_at > latest.created_at ? c : latest, paidChildren[0])
        : parent;
      return { parent, children, effective };
    });
  }, [orders]);

  const canTransferGroup = useCallback(
    (group: { parent: Order; children: Order[] }) => {
      if (group.parent.status !== 'paid') return false;
      if (!group.parent.customer_email) return false;
      if (deadlinePassed) return false;
      if (group.children.some((c) => c.status !== 'paid')) return false;
      return true;
    },
    [deadlinePassed],
  );

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Public toggle + sign out */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => handleTogglePublic(!profile.isPublic)}
            className="flex items-center gap-2.5 group shrink-0"
          >
            <div
              className="rounded-full relative transition-colors"
              style={{
                width: 40,
                height: 22,
                minHeight: 22,
                backgroundColor: profile.isPublic ? 'rgba(82,212,114,0.3)' : 'rgba(0,0,0,0.12)',
              }}
            >
              <div
                className="absolute rounded-full transition-all"
                style={{
                  width: 16,
                  height: 16,
                  top: 3,
                  backgroundColor: profile.isPublic ? '#52D472' : '#aaa',
                  left: profile.isPublic ? 21 : 3,
                }}
              />
            </div>
            <span className="text-[13px] leading-5 text-slate-600 group-hover:text-slate-800 transition-colors">
              {profile.isPublic
                ? (lang === 'zh' ? '身份卡已公開' : 'Card is public')
                : (lang === 'zh' ? '身份卡未公開' : 'Card is private')}
            </span>
          </button>
          {profile.isPublic && me?.memberNo && (
            <Link
              href={`/members/${me.memberNo}`}
              className="text-[11px] text-[#10B8D9] hover:underline truncate"
            >
              /members/{me.memberNo}
            </Link>
          )}
        </div>
        <button
          onClick={signOut}
          className="shrink-0 text-[12px] font-mono tracking-[0.15em] uppercase text-slate-400 hover:text-red-500 transition-colors"
        >
          {t.auth.logout}
        </button>
      </div>

      {/* Identity card (hero) */}
      {!loading && user?.email && (
        <MemberPassport
          email={user.email}
          memberNo={me?.memberNo ?? null}
          tier={identityTier}
          validFrom={validFrom}
          validUntil={validUntil}
          profile={profile}
          lang={lang}
          editable
          onProfileChange={setProfile}
          qrLabels={{
            qrHelper: t.collections.qrHelper,
            qrExpiresIn: t.collections.qrExpiresIn,
            qrExpired: t.collections.qrExpired,
            qrRegenerate: t.collections.qrRegenerate,
          }}
          collectionsLabel={t.collections.entryLabel}
          collectionsUnread={collectionsUnread}
        />
      )}

      {/* Upcoming events + festival countdown */}
      <UpcomingEvents registrations={lumaRegs} lang={lang} noShowConsumedCount={noShowConsumedCount} />

      {/* Orders (collapsible) */}
      <CollapsibleSection
        title={t.auth.orderHistory}
        count={loading ? '…' : orders.length}
        defaultOpen={false}
      >
        {loading ? (
          <div className="space-y-2 mt-2">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-lg p-4 bg-stone-100 animate-pulse h-16" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-slate-500 mb-3">{t.auth.noOrders}</p>
            <Link
              href="/#tickets"
              className="inline-block bg-[#10B8D9] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0EA5C4] transition-colors"
            >
              {t.nav.tickets}
            </Link>
          </div>
        ) : (
          <>
            {transferDeadline && !deadlinePassed && (
              <p className="mt-2 text-[11px] text-slate-500">
                {lang === 'zh'
                  ? `訂單轉讓功能於 ${new Date(transferDeadline).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })} 截止`
                  : `Self-service order transfer closes on ${new Date(transferDeadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
              </p>
            )}
            {deadlinePassed && (
              <p className="mt-2 text-[11px] text-amber-700">
                {lang === 'zh'
                  ? '訂單轉讓已截止，如需協助請聯絡客服。'
                  : 'Self-service transfer is closed. Please contact support for assistance.'}
              </p>
            )}
            <ul className="mt-2 space-y-2">
              {orderGroups.map(({ parent, children, effective }) => {
                const eligible = canTransferGroup({ parent, children });
                const upgraded = effective.id !== parent.id;
                const totalPaid =
                  parent.amount_total +
                  children.filter((c) => c.status === 'paid').reduce((s, c) => s + c.amount_total, 0);
                return (
                  <li key={parent.id} className="rounded-lg bg-stone-50 overflow-hidden">
                    <Link
                      href={`/order/${parent.id}`}
                      className="block p-3 hover:bg-stone-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-slate-900 capitalize text-sm">
                              {effective.ticket_tier}
                            </span>
                            <StatusBadge status={effective.status} t={t} />
                            {upgraded && (
                              <span className="text-[10px] text-slate-500 bg-stone-200 px-1.5 py-[1px] rounded capitalize">
                                {lang === 'zh' ? `由 ${parent.ticket_tier} 升級` : `upgraded from ${parent.ticket_tier}`}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">{formatDate(parent.created_at)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-slate-900 text-sm">
                            {formatAmount(totalPaid, parent.currency)}
                          </p>
                          <p className="text-[10px] text-[#10B8D9] mt-0.5">{t.auth.viewDetails} →</p>
                        </div>
                      </div>
                    </Link>

                    {children.length > 0 && (
                      <ul className="px-3 pb-2 space-y-1 bg-stone-50">
                        {children.map((c) => (
                          <li key={c.id} className="flex items-center gap-2 text-[11px] text-slate-600 pl-3 border-l-2 border-[#10B8D9]/40">
                            <span className="text-slate-400">↳</span>
                            <span className="capitalize font-medium">{c.ticket_tier}</span>
                            <StatusBadge status={c.status} t={t} />
                            <span className="font-mono text-slate-500">
                              {formatAmount(c.amount_total, c.currency)}
                            </span>
                            <Link href={`/order/${c.id}`} className="ml-auto text-[10px] text-[#10B8D9] hover:underline">
                              {t.auth.viewDetails} →
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="px-3 pb-3 pt-1 flex items-center justify-end gap-2">
                      {eligible ? (
                        <button
                          type="button"
                          onClick={() => setTransferTarget({ parent, hasChildren: children.length > 0 })}
                          className="text-[11px] font-medium text-slate-700 bg-white border border-slate-300 px-3 py-1 rounded-md hover:bg-slate-50 hover:text-[#10B8D9] hover:border-[#10B8D9]"
                        >
                          {lang === 'zh' ? '轉讓訂單' : 'Transfer'}
                        </button>
                      ) : (
                        <span
                          className="text-[10px] text-slate-400 cursor-help"
                          title={
                            deadlinePassed
                              ? (lang === 'zh' ? '轉讓已截止' : 'Transfer deadline has passed')
                              : parent.status !== 'paid'
                                ? (lang === 'zh' ? '僅已付款訂單可轉讓' : 'Only paid orders can be transferred')
                                : children.some((c) => c.status !== 'paid')
                                  ? (lang === 'zh' ? '有升級訂單待處理，請先完成' : 'Pending upgrade — resolve first')
                                  : ''
                          }
                        >
                          {lang === 'zh' ? '無法轉讓' : 'Transfer unavailable'}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CollapsibleSection>

      {/* Outgoing transfers (orders you used to own) */}
      {outgoingTransfers.length > 0 && (
        <CollapsibleSection
          title={lang === 'zh' ? '已轉出訂單' : 'Transferred out'}
          count={outgoingTransfers.length}
          defaultOpen={false}
        >
          <ul className="mt-2 space-y-2">
            {outgoingTransfers.map((t) => (
              <li key={t.id} className="rounded-lg p-3 bg-stone-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 capitalize text-sm">
                        {t.ticket_tier ?? '-'}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-50 text-red-700 border border-red-200">
                        {lang === 'zh' ? '已轉出' : 'transferred out'}
                      </span>
                      {t.initiated_by === 'admin' && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-800 border border-amber-200">
                          {lang === 'zh' ? '管理員執行' : 'by admin'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono break-all">
                      {lang === 'zh' ? '至 ' : 'to '}{t.to_email}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {new Date(t.transferred_at).toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {t.amount_total != null && t.currency && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500">
                        {`${(t.amount_total / 100).toFixed(2)} ${t.currency.toUpperCase()}`}
                      </p>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-slate-400">
            {lang === 'zh'
              ? '這些訂單已轉讓給他人，您不再擁有。若有錯誤請聯絡客服。'
              : 'These orders have been transferred to someone else and are no longer yours. Contact support if anything looks wrong.'}
          </p>
        </CollapsibleSection>
      )}

      {/* Email preferences (collapsible) */}
      {user?.email && (
        <CollapsibleSection title={lang === 'zh' ? '信件偏好' : 'Email preferences'} defaultOpen={false}>
          <div className="mt-2">
            <EmailPreferences userEmail={user.email} />
          </div>
        </CollapsibleSection>
      )}

      {transferTarget && (
        <TransferOrderModal
          open={!!transferTarget}
          onClose={() => setTransferTarget(null)}
          onSuccess={(result) => {
            setTransferTarget(null);
            setTransferToast(
              lang === 'zh'
                ? `已轉讓至 ${result.to_email}`
                : `Transferred to ${result.to_email}`,
            );
            setTimeout(() => setTransferToast(''), 5000);
            reloadOrders();
          }}
          order={{
            id: transferTarget.parent.id,
            ticket_tier: transferTarget.parent.ticket_tier,
            customer_email: transferTarget.parent.customer_email,
          }}
          endpoint="/api/order/transfer"
          mode="user"
          hasChildOrders={transferTarget.hasChildren}
        />
      )}

      {transferToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {transferToast}
        </div>
      )}

    </div>
  );
}

function MemberContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6">
        {user ? <MemberDashboard /> : <LoginForm />}
      </main>
      <Footer />
    </div>
  );
}

export default function MemberPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </div>
      }
    >
      <MemberContent />
    </Suspense>
  );
}
