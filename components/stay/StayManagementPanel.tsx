'use client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StayManagementPanel({ booking }: { booking: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Manage your stay</h2>
      <ul className="mt-4 space-y-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {booking.stay_booking_weeks.map((week: any) => (
          <li key={week.id} className="rounded-xl bg-stone-50 p-3">
            <div className="font-medium text-slate-900">{week.stay_weeks.starts_on} – {week.stay_weeks.ends_on}</div>
            <div className="text-sm text-slate-500">{week.status}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
