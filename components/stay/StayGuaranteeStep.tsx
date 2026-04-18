'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export default function StayGuaranteeStep({ clientSecret, onConfirmed }: { clientSecret: string; onConfirmed: (setupIntentId: string) => void }) {
  if (!stripePromise) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Stripe is not configured. Set <code className="font-mono">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> in <code className="font-mono">.env.local</code> to enable card verification.
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StayGuaranteeForm onConfirmed={onConfirmed} />
    </Elements>
  );
}

function StayGuaranteeForm({ onConfirmed }: { onConfirmed: (setupIntentId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();

  async function submit() {
    if (!stripe || !elements) return;
    const result = await stripe.confirmSetup({ elements, redirect: 'if_required' });
    if (result.setupIntent?.id) onConfirmed(result.setupIntent.id);
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      <button type="button" onClick={submit} className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-white">
        Verify card
      </button>
    </div>
  );
}
