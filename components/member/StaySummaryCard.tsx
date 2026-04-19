'use client';

import Link from 'next/link';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Summary = { bookings: any[]; waitlist: any[]; transfers: any[] };

export default function StaySummaryCard({ summary }: { summary: Summary }) {
  const active = summary.bookings.find((b) => ['confirmed', 'partially_transferred'].includes(b.status));
  const ctaLabel = summary.transfers.length ? 'Accept transfer' : active ? 'Manage stay' : 'Book stay';

  return (
    <section className="rounded-2xl bg-[#F4ECDF] shadow-sm p-5 border border-[#DEC9A8]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Partner Stay</h2>
          <p className="text-sm text-slate-500">Norden Ruder weekly booking</p>
        </div>
        <Link href="/stay" className="text-sm font-medium text-cyan-600 hover:underline">
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
