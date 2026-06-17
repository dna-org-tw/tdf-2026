'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';
import { apiFetch } from '@/lib/basePath';

// Brand palette (matches site/admin).
const C = {
  cyan: '#10B8D9',
  purple: '#8B5CF6',
  green: '#22C55E',
  yellow: '#EAB308',
  pink: '#EC4899',
  orange: '#F97316',
  slate: '#64748B',
};
const PIE_COLORS = [C.cyan, C.purple, C.green, C.yellow, C.pink, C.orange, '#06B6D4', '#A855F7', '#84CC16', '#F43F5E'];

interface Impact {
  generatedAt: string;
  assumptions: {
    avgStayDays: number;
    avgStayDaysSource: 'override' | 'visa' | 'default';
    visaAvgStay: number | null;
    visaProfileCount: number;
    dailySpendTwd: number;
    usdToTwd: number;
  };
  economy: {
    hardRevenueTwd: number;
    ticketTwd: number;
    eventTicketTwd: number;
    accommodationTwd: number;
    localSpendEstimateTwd: number;
    totalImpactTwd: number;
    avgOrderTwd: number;
    breakdown: Array<{ key: string; label: string; valueTwd: number; estimate: boolean }>;
  };
  participation: {
    eventsCount: number;
    totalRegistrations: number;
    activeRegistrations: number;
    checkedInCount: number;
    uniqueAttendees: number;
    avgEventsPerPerson: number;
    checkInRate: number;
    ticketTypes: Array<{ name: string; count: number }>;
    registrationTrend: Array<{ week: string; count: number }>;
  };
  contacts: { total: number; withCountry: number; countryCount: number };
  international: {
    contactsTotal: number;
    contactsWithCountry: number;
    countryCount: number;
    topCountries: Array<{ country: string; count: number }>;
    avgStayDays: number;
    visaProfileCount: number;
  };
  background: {
    profileCount: number;
    profilesWithTags: number;
    topTags: Array<{ tag: string; count: number }>;
    topLanguages: Array<{ lang: string; count: number }>;
    topLocations: Array<{ location: string; count: number }>;
  };
  voice: { newsletterActive: number; awardVotes: number; awardPosts: number };
  totals: { contacts: number };
}

// ---- formatters -----------------------------------------------------------
function ntCompact(twd: number): { value: string; unit: string } {
  if (twd >= 1e8) return { value: (twd / 1e8).toFixed(twd >= 1e9 ? 0 : 1), unit: '億' };
  if (twd >= 1e4) return { value: (twd / 1e4).toFixed(twd >= 1e6 ? 0 : 1), unit: '萬' };
  return { value: Math.round(twd).toLocaleString(), unit: '' };
}
function nt(twd: number) {
  return `NT$ ${Math.round(twd).toLocaleString()}`;
}
function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}

export default function ImpactPage() {
  const [data, setData] = useState<Impact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<number | null>(null);
  const [partners, setPartners] = useState<number | null>(null);

  // tunable assumptions
  const [dailySpend, setDailySpend] = useState(2500);
  const [usdRate, setUsdRate] = useState(32);
  const [stayDays, setStayDays] = useState<string>(''); // empty -> auto from visa data

  // Re-fetches whenever a tunable assumption changes. State is only set inside
  // async callbacks so the effect never triggers cascading synchronous renders.
  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ dailySpend: String(dailySpend), usdRate: String(usdRate) });
    if (stayDays.trim()) q.set('stayDays', stayDays.trim());
    apiFetch(`/api/admin/impact?${q.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) throw new Error(d.error);
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message || e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dailySpend, usdRate, stayDays]);

  // Speakers (live Luma calendar) + partners (Google Sheet) via public endpoints.
  useEffect(() => {
    apiFetch('/api/luma-data')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.speakers)) setSpeakers(d.speakers.length);
      })
      .catch(() => {});
    apiFetch('/api/partners')
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : d?.partners;
        if (Array.isArray(list)) setPartners(list.length);
      })
      .catch(() => {});
  }, []);

  if (loading && !data) return <Skeleton />;
  if (error && !data)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">嘉年華成效</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6">載入失敗：{error}</div>
      </div>
    );
  if (!data) return null;

  const { economy, participation, international, background, voice, totals, assumptions } = data;

  return (
    <div className="space-y-8 print:space-y-6">
      {/* Header / controls (hidden in print) */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">嘉年華成效</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
          >
            列印 / 匯出 PDF
          </button>
        </div>
      </div>

      {/* HERO */}
      <section className="rounded-2xl bg-gradient-to-br from-[#0B1120] via-[#16243d] to-[#0B1120] text-white p-8 md:p-10 shadow-xl print:shadow-none">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300/80 mb-1">Taiwan Digital Fest 2026</p>
        <h2 className="text-xl md:text-2xl font-semibold text-white/90">嘉年華整體成效一覽</h2>
        <p className="text-xs text-white/50 mt-1 mb-8">
          所有統計以 <span className="text-white/80 font-medium">{data.contacts.total.toLocaleString()}</span> 位有信箱聯絡人為母體
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <HeroNum
            label="經濟效益總估值"
            big={ntCompact(economy.totalImpactTwd)}
            prefix="NT$"
            accent={C.green}
            note="實收＋在地消費推估"
          />
          <HeroNum
            label="總參與人次"
            big={ntCompact(participation.activeRegistrations)}
            accent={C.cyan}
            note={`${participation.eventsCount} 場活動報名`}
          />
          <HeroNum
            label="參與國家數"
            big={{ value: String(international.countryCount), unit: '' }}
            accent={C.purple}
            note="有信箱聯絡人來源國"
          />
          <HeroNum
            label="不重複參與者"
            big={ntCompact(participation.uniqueAttendees)}
            accent={C.yellow}
            note={`人均 ${participation.avgEventsPerPerson} 場`}
          />
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <MiniStat label="實際報到人次" value={participation.checkedInCount.toLocaleString()} />
          <MiniStat label="有信箱聯絡人" value={totals.contacts.toLocaleString()} />
          <MiniStat label="講者人數" value={speakers == null ? '—' : speakers.toLocaleString()} />
          <MiniStat label="合作夥伴" value={partners == null ? '—' : partners.toLocaleString()} />
        </div>
      </section>

      {/* ① 經濟效益 */}
      <Section title="① 經濟效益" subtitle="實收硬數據＋在地消費推估，全數換算為新台幣">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={economy.breakdown.map((b) => ({ ...b, valueWan: Math.round(b.valueTwd / 1e4) }))}
                margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit=" 萬" />
                <Tooltip formatter={(v) => nt(Number(v) * 1e4)} labelStyle={{ color: '#0f172a' }} />
                <Bar dataKey="valueWan" radius={[6, 6, 0, 0]}>
                  {economy.breakdown.map((b, i) => (
                    <Cell key={b.key} fill={b.estimate ? C.green : PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="valueWan"
                    position="top"
                    formatter={(v) => `${v} 萬`}
                    style={{ fontSize: 11, fill: '#475569' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <BigStat label="總經濟效益（含推估）" value={nt(economy.totalImpactTwd)} color={C.green} />
            <BigStat label="實收硬數據合計" value={nt(economy.hardRevenueTwd)} color={C.cyan} />
            <BigStat label="在地消費推估" value={nt(economy.localSpendEstimateTwd)} color={C.purple} estimate />
            <BigStat label="平均客單價" value={nt(economy.avgOrderTwd)} color={C.slate} />
          </div>
        </div>
        <AssumptionBar
          dailySpend={dailySpend}
          usdRate={usdRate}
          stayDays={stayDays}
          assumptions={assumptions}
          uniqueAttendees={participation.uniqueAttendees}
          onChange={(next) => {
            if (next.dailySpend !== undefined) setDailySpend(next.dailySpend);
            if (next.usdRate !== undefined) setUsdRate(next.usdRate);
            if (next.stayDays !== undefined) setStayDays(next.stayDays);
          }}
        />
      </Section>

      {/* ② 參與規模 (Luma) */}
      <Section title="② 參與規模" subtitle="資料以 Luma 活動報名與報到為準">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard label="活動場次" value={participation.eventsCount.toLocaleString()} color={C.cyan} />
          <KpiCard label="總報名數" value={participation.activeRegistrations.toLocaleString()} color={C.purple} />
          <KpiCard label="實際報到" value={participation.checkedInCount.toLocaleString()} color={C.green} />
          <KpiCard label="報到率" value={pct(participation.checkInRate)} color={C.yellow} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h4 className="text-sm font-medium text-slate-500 mb-2">報名成長（每週累積報名數）</h4>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={participation.registrationTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.cyan} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={C.cyan} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={(w: string) => w.slice(5)} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip labelStyle={{ color: '#0f172a' }} />
                <Area type="monotone" dataKey="count" name="報名數" stroke={C.cyan} strokeWidth={2} fill="url(#regGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-500 mb-2">票種分布</h4>
            <DonutChart data={participation.ticketTypes.slice(0, 8).map((t) => ({ name: t.name, value: t.count }))} />
          </div>
        </div>
      </Section>

      {/* ③ 國際化與觸及 */}
      <Section
        title="③ 國際化與觸及"
        subtitle={`有信箱聯絡人之國別分布與停留天數（國別基於 ${international.contactsWithCountry.toLocaleString()} 位可定位聯絡人）`}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard label="有信箱聯絡人" value={international.contactsTotal.toLocaleString()} color={C.cyan} />
          <KpiCard label="來源國家／地區" value={String(international.countryCount)} color={C.purple} />
          <KpiCard label="可定位聯絡人" value={international.contactsWithCountry.toLocaleString()} color={C.green} />
          <KpiCard
            label="平均停留天數"
            value={`${international.avgStayDays} 天`}
            color={C.yellow}
            note={assumptions.avgStayDaysSource === 'visa' ? `來自 ${international.visaProfileCount} 份簽證資料` : '預估'}
          />
        </div>
        <div>
          <h4 className="text-sm font-medium text-slate-500 mb-2">聯絡人來源國 Top 14</h4>
          <HBars data={international.topCountries.map((c) => ({ label: c.country, value: c.count }))} color={C.cyan} />
        </div>
      </Section>

      {/* ④ 參與者背景 */}
      <Section
        title="④ 參與者背景"
        subtitle={`基於 ${background.profilesWithTags} 位填寫個人檔案的會員（共 ${background.profileCount} 份檔案）`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-slate-500 mb-2">技能 / 領域標籤 Top 12</h4>
            {background.topTags.length ? (
              <HBars data={background.topTags.map((t) => ({ label: t.tag, value: t.count }))} color={C.purple} />
            ) : (
              <Empty note="尚無標籤資料" />
            )}
          </div>
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">語言別</h4>
              {background.topLanguages.length ? (
                <HBars data={background.topLanguages.map((l) => ({ label: l.lang, value: l.count }))} color={C.green} />
              ) : (
                <Empty note="尚無語言資料" />
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ⑤ 數位聲量 */}
      <Section title="⑤ 數位聲量" subtitle="電子報、Nomad Award 與社群互動">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="電子報有效訂閱" value={voice.newsletterActive.toLocaleString()} color={C.cyan} />
          <KpiCard label="Nomad Award 投票" value={voice.awardVotes.toLocaleString()} color={C.pink} />
          <KpiCard label="參賽 Reels 作品" value={voice.awardPosts.toLocaleString()} color={C.purple} />
          <KpiCard label="講者人數" value={speakers == null ? '—' : speakers.toLocaleString()} color={C.yellow} />
        </div>
      </Section>

      <p className="text-xs text-slate-400 text-center pt-2">
        產生時間：{new Date(data.generatedAt).toLocaleString('zh-TW')}　·　標示「預估」之數字為依假設推算，非實際金流
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function HeroNum({
  label,
  big,
  prefix,
  note,
  accent,
}: {
  label: string;
  big: { value: string; unit: string };
  prefix?: string;
  note?: string;
  accent: string;
}) {
  return (
    <div>
      <p className="text-xs text-white/60 mb-1">{label}</p>
      <p className="font-bold leading-none flex items-baseline gap-1">
        {prefix && <span className="text-lg text-white/70">{prefix}</span>}
        <span className="text-4xl md:text-5xl tabular-nums" style={{ color: accent }}>
          {big.value}
        </span>
        {big.unit && <span className="text-2xl text-white/80">{big.unit}</span>}
      </p>
      {note && <p className="text-xs text-white/50 mt-1.5">{note}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-white/50 text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl p-6 md:p-7 shadow-sm border border-slate-100 break-inside-avoid">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function KpiCard({ label, value, color, note }: { label: string; value: string; color: string; note?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1" style={{ color }}>
        {value}
      </p>
      {note && <p className="text-[11px] text-slate-400 mt-0.5">{note}</p>}
    </div>
  );
}

function BigStat({ label, value, color, estimate }: { label: string; value: string; color: string; estimate?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          {label}
          {estimate && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">預估</span>
          )}
        </p>
        <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function DonutChart({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data.length) return <Empty note="尚無資料" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function HBars({ data, color }: { data: Array<{ label: string; value: number }>; color: string }) {
  if (!data.length) return <Empty note="尚無資料" />;
  const height = Math.max(160, data.length * 30);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={110} />
        <Tooltip />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={16}>
          <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#475569' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AssumptionBar({
  dailySpend,
  usdRate,
  stayDays,
  assumptions,
  uniqueAttendees,
  onChange,
}: {
  dailySpend: number;
  usdRate: number;
  stayDays: string;
  assumptions: Impact['assumptions'];
  uniqueAttendees: number;
  onChange: (n: { dailySpend?: number; usdRate?: number; stayDays?: string }) => void;
}) {
  return (
    <div className="mt-5 rounded-xl bg-slate-50 border border-slate-100 p-4 print:bg-white text-sm">
      <p className="text-xs font-medium text-slate-500 mb-3">
        在地消費推估假設（可調整）· 公式：不重複參與者 {uniqueAttendees.toLocaleString()} × 平均停留 {assumptions.avgStayDays} 天 × 每日消費 NT${dailySpend.toLocaleString()}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
        <NumField
          label="每人每日在地消費 (NT$)"
          value={dailySpend}
          onCommit={(v) => v !== '' && onChange({ dailySpend: v })}
        />
        <NumField
          label={`平均停留天數${assumptions.avgStayDaysSource === 'visa' ? `（自動 ${assumptions.visaAvgStay} 天）` : ''}`}
          value={stayDays}
          placeholder={String(assumptions.avgStayDays)}
          onCommit={(v) => onChange({ stayDays: v === '' ? '' : String(v) })}
          allowEmpty
        />
        <NumField label="USD → TWD 匯率" value={usdRate} onCommit={(v) => v !== '' && onChange({ usdRate: v })} />
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  placeholder,
  onCommit,
  allowEmpty,
}: {
  label: string;
  value: number | string;
  placeholder?: string;
  onCommit: (v: number | '') => void;
  allowEmpty?: boolean;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => {
    setV(String(value));
  }, [value]);
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        type="number"
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v.trim() === '') {
            if (allowEmpty) onCommit('');
            return;
          }
          const n = Number(v);
          if (Number.isFinite(n)) onCommit(n);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
      />
    </label>
  );
}

function Empty({ note }: { note: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
      {note}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">嘉年華成效</h1>
      <div className="h-56 rounded-2xl bg-slate-200 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
