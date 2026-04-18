'use client';

import { useParams } from 'next/navigation';

export default function StayTransferAcceptPage() {
  const params = useParams<{ id: string }>();
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-24">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Accept transferred stay</h1>
        <p className="mt-2 text-sm text-slate-600">Transfer id: {params.id}</p>
        <p className="mt-2 text-sm text-slate-600">If this is a guaranteed booking, verify your card before accepting.</p>
      </div>
    </main>
  );
}
