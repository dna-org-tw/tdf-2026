'use client';

import { useState } from 'react';
import StayGuaranteeStep from './StayGuaranteeStep';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StayBookingPanel({ weeks, memberEmail }: { weeks: any[]; memberEmail: string | null }) {
  const [weekCodes, setWeekCodes] = useState<string[]>([]);
  const [primaryGuestName, setPrimaryGuestName] = useState('');
  const [primaryGuestPhone, setPrimaryGuestPhone] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupIntentId, setSetupIntentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!memberEmail) {
    return (
      <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sign in to book</h2>
        <p className="mt-2 text-sm text-slate-500">Only members can reserve the partner stay.</p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookableWeeks = weeks.filter((w: any) => w.booking_open !== false);

  function toggleWeek(code: string) {
    setWeekCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
    // Invalidate any prior card verification since the week set changed.
    setClientSecret(null);
    setSetupIntentId(null);
  }

  async function startCardVerification() {
    setError(null);
    const res = await fetch('/api/stay/setup-intent', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'setup_intent_failed');
      return;
    }
    const data = await res.json();
    setClientSecret(data.clientSecret);
  }

  const canSubmit = weekCodes.length > 0 && (inviteCode.trim().length > 0 || setupIntentId !== null);
  const showVerifyCardButton = !inviteCode.trim() && weekCodes.length > 0 && clientSecret === null;

  async function submitBooking() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/stay/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryGuestName,
          primaryGuestPhone,
          guestCount: 1,
          secondGuestName: null,
          weekCodes,
          inviteCode: inviteCode.trim() || null,
          setupIntentId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'booking_failed');
        return;
      }
      alert('Booking confirmed');
      window.location.reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Reserve your stay</h2>

      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium text-slate-700">Choose weeks</p>
        {bookableWeeks.length === 0 ? (
          <p className="text-sm text-slate-500">No weeks available.</p>
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          bookableWeeks.map((w: any) => (
            <label key={w.code} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={weekCodes.includes(w.code)}
                onChange={() => toggleWeek(w.code)}
              />
              <span>
                {w.code} · {w.starts_on} → {w.ends_on} · NT${w.price_twd} / 7 nights
              </span>
            </label>
          ))
        )}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Primary guest name</label>
          <input
            type="text"
            value={primaryGuestName}
            onChange={(e) => setPrimaryGuestName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Primary guest phone</label>
          <input
            type="tel"
            value={primaryGuestPhone}
            onChange={(e) => setPrimaryGuestPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>

        <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-slate-500">
          Single occupancy only — one guest per room.
        </p>

        <div>
          <label className="block text-sm font-medium text-slate-700">Invite code (optional)</label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => {
              setInviteCode(e.target.value);
              // Switching modes invalidates any card verification.
              setClientSecret(null);
              setSetupIntentId(null);
            }}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>

        {showVerifyCardButton && (
          <button
            type="button"
            onClick={startCardVerification}
            className="w-full rounded-xl border border-cyan-500 px-4 py-3 text-sm font-medium text-cyan-600"
          >
            Verify card
          </button>
        )}

        {clientSecret && !setupIntentId && (
          <StayGuaranteeStep clientSecret={clientSecret} onConfirmed={setSetupIntentId} />
        )}

        {setupIntentId && (
          <p className="text-xs text-emerald-600">Card verified.</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={submitBooking}
          className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Submit booking
        </button>
      </div>
    </div>
  );
}
