import type { Language } from '@/data/content';

const WHATSAPP_URL = 'https://chat.whatsapp.com/KZsFo7oNvZVCPIF86imk0E';
const EMAIL = 'fest@dna.org.tw';
const IG = 'taiwandigitalfest';

const copy = {
  zh: {
    label: '聯絡我們',
    title: '找不到答案？直接問我們最快',
    intro: '加入 WhatsApp 社群群組可以直接和工作人員與其他參與者交流；email 回覆較慢，可作為備選方式。',
    whatsapp: '加入 WhatsApp 社群',
    whatsappHint: '主辦方與參與者都在裡面',
    emailLabel: '寄信給主辦方',
    ig: 'Instagram',
  },
  en: {
    label: 'Contact',
    title: "Can't find what you need? Ask us directly",
    intro: 'Join the WhatsApp community to chat with the team and other participants in real time. Email is a slower fallback.',
    whatsapp: 'Join the WhatsApp community',
    whatsappHint: 'Both the organizers and participants hang out here',
    emailLabel: 'Email the organizers',
    ig: 'Instagram',
  },
} as const;

export default function GuideContactCard({ lang, variant = 'full' }: { lang: Language; variant?: 'full' | 'inline' }) {
  const t = copy[lang];

  if (variant === 'inline') {
    return (
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-cyan-950">
        <p className="text-sm font-semibold">{t.title}</p>
        <p className="mt-1 text-sm leading-6">{t.intro}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1fb858]"
          >
            {t.whatsapp}
          </a>
          <a
            href={`mailto:${EMAIL}`}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300 bg-white px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-100"
          >
            {t.emailLabel}（{EMAIL}）
          </a>
        </div>
      </div>
    );
  }

  return (
    <section
      id="contact"
      className="scroll-mt-44 rounded-[28px] border border-stone-200 bg-[#10B8D9] p-6 text-white sm:p-8"
    >
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">{t.label}</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{t.title}</h2>
        <p className="mt-3 text-sm leading-7 text-white/90 sm:text-base">{t.intro}</p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-[auto_1fr]">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#1fb858]"
        >
          {t.whatsapp}
        </a>
        <p className="self-center text-sm text-white/85">{t.whatsappHint}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/90">
        <a href={`mailto:${EMAIL}`} className="underline underline-offset-4 hover:text-white">
          {t.emailLabel}（{EMAIL}）
        </a>
        <a
          href={`https://instagram.com/${IG}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-white"
        >
          {t.ig}（@{IG}）
        </a>
      </div>
    </section>
  );
}
