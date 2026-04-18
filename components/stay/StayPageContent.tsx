'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import StayHero from './StayHero';
import StayRoomDetails from './StayRoomDetails';
import StayInventoryGrid from './StayInventoryGrid';
import StayPolicyNotice from './StayPolicyNotice';
import StayBookingPanel from './StayBookingPanel';
import StayManagementPanel from './StayManagementPanel';

export default function StayPageContent() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [weeks, setWeeks] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [summary, setSummary] = useState<{ bookings: any[]; waitlist: any[]; transfers: any[] } | null>(null);

  useEffect(() => {
    fetch('/api/stay/weeks').then((r) => r.json()).then((d) => setWeeks(d.weeks ?? []));
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    fetch('/api/stay/bookings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSummary(d))
      .catch(() => setSummary(null));
  }, [user?.email]);

  const activeBooking = summary?.bookings.find((b) =>
    ['confirmed', 'partially_transferred'].includes(b.status),
  );

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)]">
          <section className="space-y-6">
            <StayHero stay={t.stay} lang={lang} />
            <StayRoomDetails stay={t.stay} />
            <StayInventoryGrid weeks={weeks} stay={t.stay} />
          </section>
          <aside className="space-y-6 lg:sticky lg:top-24 h-fit">
            {activeBooking ? (
              <StayManagementPanel booking={activeBooking} />
            ) : (
              <StayBookingPanel weeks={weeks} memberEmail={user?.email ?? null} />
            )}
            <StayPolicyNotice stay={t.stay} />
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
