import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  mergeAndSort,
  normalizeOrderAction,
  normalizeOrderTransfer,
  normalizeVisaLetterIssuance,
  type AuditSource,
  type OrderActionRow,
  type OrderTransferRow,
  type UnifiedEvent,
  type VisaLetterIssuanceRow,
} from '@/lib/adminAuditing';

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 90;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const DAY_MS = 86_400_000;

const ALL_SOURCES: AuditSource[] = ['order_action', 'order_transfer', 'visa_letter'];

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const url = new URL(req.url);
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS);

  const from = parseDate(url.searchParams.get('from'), defaultFrom);
  const to = parseDate(url.searchParams.get('to'), now);
  if (!from || !to) {
    return NextResponse.json({ error: 'Invalid from/to' }, { status: 400 });
  }
  if (to.getTime() < from.getTime()) {
    return NextResponse.json({ error: '`to` must be >= `from`' }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_WINDOW_DAYS * DAY_MS) {
    return NextResponse.json(
      { error: `Window cannot exceed ${MAX_WINDOW_DAYS} days` },
      { status: 400 },
    );
  }

  const limitParam = Number(url.searchParams.get('limit'));
  const limit = Math.min(
    MAX_LIMIT,
    Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT,
  );
  const fetchCap = limit + 1;

  const sourcesParam = url.searchParams.get('source');
  const sources: AuditSource[] = sourcesParam
    ? sourcesParam
        .split(',')
        .filter((s): s is AuditSource => (ALL_SOURCES as string[]).includes(s))
    : ALL_SOURCES;

  const actor = url.searchParams.get('actor')?.trim() || null;
  const action = url.searchParams.get('action')?.trim() || null;
  const q = url.searchParams.get('q')?.trim() || null;

  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  try {
    const [oaEvents, otEvents, vlEvents] = await Promise.all([
      sources.includes('order_action')
        ? fetchOrderActions({ fromIso, toIso, actor, action, fetchCap })
        : Promise.resolve<UnifiedEvent[]>([]),
      sources.includes('order_transfer')
        ? fetchOrderTransfers({ fromIso, toIso, actor, action, fetchCap })
        : Promise.resolve<UnifiedEvent[]>([]),
      sources.includes('visa_letter')
        ? fetchVisaLetterIssuances({ fromIso, toIso, actor, action, fetchCap })
        : Promise.resolve<UnifiedEvent[]>([]),
    ]);

    const merged = mergeAndSort([...oaEvents, ...otEvents, ...vlEvents]);
    const filtered = q ? merged.filter((e) => matchesQuery(e, q)) : merged;
    const sliced = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;

    return NextResponse.json({
      events: sliced,
      hasMore,
      window: { from: fromIso, to: toIso },
    });
  } catch (err) {
    console.error('[Admin Auditing]', err);
    return NextResponse.json({ error: 'Failed to fetch audit events' }, { status: 500 });
  }
}

function parseDate(raw: string | null, fallback: Date): Date | null {
  if (!raw) return fallback;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function matchesQuery(ev: UnifiedEvent, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    ev.resourceId.toLowerCase().includes(needle) ||
    ev.resourceLabel.toLowerCase().includes(needle) ||
    ev.summary.toLowerCase().includes(needle)
  );
}

type FetchOpts = {
  fromIso: string;
  toIso: string;
  actor: string | null;
  action: string | null;
  fetchCap: number;
};

async function fetchOrderActions(opts: FetchOpts): Promise<UnifiedEvent[]> {
  let q = supabaseServer!
    .from('order_actions')
    .select('*')
    .gte('created_at', opts.fromIso)
    .lte('created_at', opts.toIso)
    .order('created_at', { ascending: false })
    .limit(opts.fetchCap);
  if (opts.actor) q = q.ilike('admin_email', `%${opts.actor}%`);
  if (opts.action) q = q.eq('action', opts.action);
  const { data, error } = await q;
  if (error) throw error;
  return (data as OrderActionRow[]).map(normalizeOrderAction);
}

async function fetchOrderTransfers(opts: FetchOpts): Promise<UnifiedEvent[]> {
  if (opts.action && opts.action !== 'transfer') return [];
  let q = supabaseServer!
    .from('order_transfers')
    .select('*')
    .gte('transferred_at', opts.fromIso)
    .lte('transferred_at', opts.toIso)
    .order('transferred_at', { ascending: false })
    .limit(opts.fetchCap);
  if (opts.actor) {
    q = q.or(
      `actor_admin_email.ilike.%${opts.actor}%,from_email.ilike.%${opts.actor}%`,
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data as OrderTransferRow[]).map(normalizeOrderTransfer);
}

async function fetchVisaLetterIssuances(opts: FetchOpts): Promise<UnifiedEvent[]> {
  if (opts.action && opts.action !== 'visa_issue') return [];
  let q = supabaseServer!
    .from('visa_letter_issuances')
    .select('*')
    .gte('issued_at', opts.fromIso)
    .lte('issued_at', opts.toIso)
    .order('issued_at', { ascending: false })
    .limit(opts.fetchCap);
  if (opts.actor) q = q.ilike('issued_by', `%${opts.actor}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data as VisaLetterIssuanceRow[]).map(normalizeVisaLetterIssuance);
}
