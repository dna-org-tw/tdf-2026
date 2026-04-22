'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import StayGuaranteeStep from './StayGuaranteeStep';
import { PHONE_COUNTRIES } from '@/lib/phoneCountries';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StayBookingPanel({ weeks, memberEmail }: { weeks: any[]; memberEmail: string | null }) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [weekCodes, setWeekCodes] = useState<string[]>([]);
  const [primaryGuestName, setPrimaryGuestName] = useState('');
  const [phoneDial, setPhoneDial] = useState('+886');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [inviteCode, setInviteCode] = useState(() => searchParams.get('invite') ?? '');
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closedWeeks = weeks.filter((w: any) => w.booking_open === false);
  const allClosed = weeks.length > 0 && bookableWeeks.length === 0;

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

  const E164_RE = /^\+[1-9]\d{6,14}$/;
  const phoneLocalDigits = phoneLocal.replace(/\D/g, '');
  const combinedPhone = phoneDial + phoneLocalDigits;
  const phoneValid = E164_RE.test(combinedPhone);
  const phoneShowError = phoneLocal.length > 0 && !phoneValid;

  const canSubmit =
    weekCodes.length > 0 &&
    primaryGuestName.trim().length > 0 &&
    phoneValid &&
    (inviteCode.trim().length > 0 || setupIntentId !== null);
  const showVerifyCardButton = !inviteCode.trim() && weekCodes.length > 0 && clientSecret === null;

  async function submitBooking() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/stay/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryGuestName: primaryGuestName.trim(),
          primaryGuestPhone: combinedPhone,
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
        {bookableWeeks.length === 0 && closedWeeks.length === 0 ? (
          <p className="text-sm text-slate-500">No weeks available.</p>
        ) : (
          <>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {bookableWeeks.map((w: any) => (
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
            ))}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {closedWeeks.map((w: any) => (
              <label
                key={w.code}
                className="flex items-center gap-2 text-sm text-slate-400 cursor-not-allowed"
                title={t.stay.bookingClosedNote}
              >
                <input type="checkbox" disabled checked={false} />
                <span className="line-through">
                  {w.code} · {w.starts_on} → {w.ends_on} · NT${w.price_twd} / 7 nights
                </span>
                <span className="ml-1 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500 no-underline">
                  {t.stay.bookingClosedLabel}
                </span>
              </label>
            ))}
          </>
        )}
        {allClosed && (
          <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
            {t.stay.bookingClosedNote}
          </p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Primary guest name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={primaryGuestName}
            onChange={(e) => setPrimaryGuestName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Primary guest phone <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 flex gap-2">
            <select
              value={phoneDial}
              onChange={(e) => setPhoneDial(e.target.value)}
              className="w-36 rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm"
              aria-label="Country dial code"
            >
              {PHONE_COUNTRIES.map((c) => (
                <option key={c.code} value={c.dial}>
                  {c.dial} {c.name}
                </option>
              ))}
            </select>
            <input
              type="tel"
              required
              inputMode="numeric"
              placeholder="912345678"
              value={phoneLocal}
              onChange={(e) => setPhoneLocal(e.target.value)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                phoneShowError ? 'border-red-400' : 'border-stone-300'
              }`}
            />
          </div>
          <p className={`mt-1 text-xs ${phoneShowError ? 'text-red-600' : 'text-slate-500'}`}>
            {phoneShowError
              ? 'Enter your local number (digits only) — the country code is set above.'
              : 'Digits only; country code is selected from the dropdown.'}
          </p>
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
