// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StayPolicyNotice({ stay }: { stay: any }) {
  return (
    <section className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-rose-800">{stay.policyTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-rose-700">{stay.policyBody}</p>
      <p className="mt-2 text-xs font-medium text-rose-600">{stay.cutoffNote}</p>
    </section>
  );
}
