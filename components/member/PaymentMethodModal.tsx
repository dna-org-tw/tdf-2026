'use client';

import { useEffect, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

// Modal that walks a member through binding a payment method as off-session
// guarantee for event confirmations. The shape mirrors components/stay/
// StayGuaranteeStep.tsx but is self-contained (handles its own SetupIntent
// fetch + completion POST + close lifecycle).

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let cachedStripe: Promise<Stripe | null> | null = null;
function getStripePromise() {
  if (!publishableKey) return null;
  cachedStripe ??= loadStripe(publishableKey);
  return cachedStripe;
}

type Props = {
  lang: 'en' | 'zh';
  onClose: () => void;
  onConfirmed: () => void;
};

export default function PaymentMethodModal({ lang, onClose, onConfirmed }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupIntentId, setSetupIntentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/payment-method/setup', { method: 'POST' })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'setup_failed');
        if (cancelled) return;
        setClientSecret(body.clientSecret);
        setSetupIntentId(body.setupIntentId);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stripePromise = getStripePromise();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal>
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label={lang === 'zh' ? '關閉' : 'Close'}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
            <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h2 className="font-display text-lg font-bold text-slate-900">
          {lang === 'zh' ? '綁定擔保信用卡' : 'Save payment method'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {lang === 'zh'
            ? '確認出席後若未到場，將以該活動 Standard Ticket 票價扣款。免費活動不會扣款。'
            : 'If you confirm and no-show, we charge the event’s Standard Ticket price. Free events incur no charge.'}
        </p>
        <div className="mt-5">
          {!publishableKey ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {lang === 'zh'
                ? 'Stripe 尚未設定。請聯絡管理員設定 NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY。'
                : 'Stripe not configured. Ask an admin to set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.'}
            </div>
          ) : loading ? (
            <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {lang === 'zh' ? '無法載入：' : 'Failed to load: '}
              {error}
            </div>
          ) : clientSecret && setupIntentId && stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentMethodForm
                lang={lang}
                setupIntentId={setupIntentId}
                onConfirmed={onConfirmed}
              />
            </Elements>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PaymentMethodForm({
  lang,
  setupIntentId,
  onConfirmed,
}: {
  lang: 'en' | 'zh';
  setupIntentId: string;
  onConfirmed: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await stripe.confirmSetup({ elements, redirect: 'if_required' });
      if (result.error) {
        setError(result.error.message ?? 'card_error');
        return;
      }
      if (result.setupIntent?.status !== 'succeeded') {
        setError(lang === 'zh' ? '驗卡未完成' : 'Setup did not complete');
        return;
      }
      const persistResp = await fetch('/api/me/payment-method', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ setupIntentId }),
      });
      if (!persistResp.ok) {
        const body = await persistResp.json().catch(() => ({}));
        throw new Error(body.error ?? 'persist_failed');
      }
      onConfirmed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={submitting || !stripe || !elements}
        className="w-full rounded-xl bg-[#10B8D9] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0EA5C4] disabled:opacity-60"
      >
        {submitting
          ? lang === 'zh' ? '處理中…' : 'Processing…'
          : lang === 'zh' ? '完成綁定' : 'Save card'}
      </button>
    </div>
  );
}
