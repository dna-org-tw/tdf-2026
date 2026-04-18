'use client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StayBookingPanel({ weeks, memberEmail }: { weeks: any[]; memberEmail: string | null }) {
  if (!memberEmail) {
    return (
      <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sign in to book</h2>
        <p className="mt-2 text-sm text-slate-500">Only members can reserve the partner stay.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Reserve your stay</h2>
      <p className="mt-2 text-sm text-slate-500">{weeks.length} weeks available for selection.</p>
    </div>
  );
}
