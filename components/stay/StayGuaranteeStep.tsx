'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function StayGuaranteeStep({ clientSecret, onConfirmed }: { clientSecret: string; onConfirmed: (setupIntentId: string) => void }) {
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
