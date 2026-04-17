import { SignJWT, jwtVerify } from 'jose';
import { supabaseServer } from './supabaseServer';

const QR_TOKEN_TTL_SECONDS = 300;

let cachedQrSecret: Uint8Array | null = null;

function getQrSecret(): Uint8Array {
  if (cachedQrSecret) return cachedQrSecret;
  const secret = process.env.MEMBER_QR_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MEMBER_QR_SECRET environment variable is required in production');
    }
    const fallback = process.env.AUTH_SECRET ?? 'dev-member-qr-secret';
    console.warn('[memberCollections] MEMBER_QR_SECRET not set — using fallback. Set it for production.');
    cachedQrSecret = new TextEncoder().encode(fallback);
    return cachedQrSecret;
  }
  cachedQrSecret = new TextEncoder().encode(secret);
  return cachedQrSecret;
}

export interface QrTokenPayload {
  member_no: string;
  exp: number;
}

export async function issueQrToken(memberNo: string): Promise<{ token: string; expiresAt: string }> {
  const expSeconds = Math.floor(Date.now() / 1000) + QR_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({ member_no: memberNo })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expSeconds)
    .sign(getQrSecret());
  return { token, expiresAt: new Date(expSeconds * 1000).toISOString() };
}

export async function verifyQrToken(token: string): Promise<QrTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getQrSecret());
    if (typeof payload.member_no !== 'string') return null;
    if (typeof payload.exp !== 'number') return null;
    return { member_no: payload.member_no, exp: payload.exp };
  } catch {
    return null;
  }
}

export interface CollectionEntry {
  member_no: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  tags: string[];
  tier: string;
  collected_at: string;
  source: 'public' | 'qr';
  is_unread?: boolean;
}

export async function getMemberIdByEmail(email: string): Promise<number | null> {
  if (!supabaseServer) return null;
  const { data } = await supabaseServer
    .from('members')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getMemberIdByNo(memberNo: string): Promise<number | null> {
  if (!supabaseServer) return null;
  const { data } = await supabaseServer
    .from('members')
    .select('id')
    .eq('member_no', memberNo)
    .maybeSingle();
  return data?.id ?? null;
}

interface RawProfileRow {
  member_id: number;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  tags: string[] | null;
  is_public: boolean;
}

async function hydrateEntries(
  rows: Array<{ member_id: number; created_at: string; source: 'public' | 'qr' }>,
  opts: { unreadSince?: string | null | undefined } = {},
): Promise<CollectionEntry[]> {
  if (!supabaseServer || rows.length === 0) return [];
  const memberIds = rows.map((r) => r.member_id);

  const { data: members } = await supabaseServer
    .from('members')
    .select('id, member_no')
    .in('id', memberIds);
  const idToNo = new Map<number, string>((members ?? []).map((m) => [m.id as number, m.member_no as string]));

  const { data: profiles } = await supabaseServer
    .from('member_profiles')
    .select('member_id, display_name, avatar_url, bio, location, tags, is_public')
    .in('member_id', memberIds);
  const profileByMemberId = new Map<number, RawProfileRow>(
    (profiles ?? []).map((p) => [p.member_id as number, p as RawProfileRow]),
  );

  const memberNos = Array.from(idToNo.values()).filter(Boolean);
  const { data: enriched } = await supabaseServer
    .from('members_enriched')
    .select('member_no, highest_ticket_tier')
    .in('member_no', memberNos);
  const tierByNo = new Map<string, string>(
    (enriched ?? []).map((e) => [e.member_no as string, (e.highest_ticket_tier as string) || 'follower']),
  );

  const hasUnreadFlag = 'unreadSince' in opts;
  const unreadSinceMs = opts.unreadSince ? new Date(opts.unreadSince).getTime() : null;

  return rows.map((r) => {
    const memberNo = idToNo.get(r.member_id) ?? '';
    const profile = profileByMemberId.get(r.member_id);
    const entry: CollectionEntry = {
      member_no: memberNo,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      bio: profile?.bio ?? null,
      location: profile?.location ?? null,
      tags: profile?.tags ?? [],
      tier: tierByNo.get(memberNo) ?? 'follower',
      collected_at: r.created_at,
      source: r.source,
    };
    if (hasUnreadFlag) {
      entry.is_unread = unreadSinceMs === null
        ? true
        : new Date(r.created_at).getTime() > unreadSinceMs;
    }
    return entry;
  });
}

export async function fetchCollectionsForMember(memberId: number) {
  if (!supabaseServer) {
    return { collected: [], collectors: [], unreadCount: 0 };
  }

  const [collectedRes, collectorsRes, profileRes] = await Promise.all([
    supabaseServer
      .from('member_collections')
      .select('collected_member_id, created_at, source')
      .eq('collector_member_id', memberId)
      .order('created_at', { ascending: false }),
    supabaseServer
      .from('member_collections')
      .select('collector_member_id, created_at, source')
      .eq('collected_member_id', memberId)
      .order('created_at', { ascending: false }),
    supabaseServer
      .from('member_profiles')
      .select('collections_last_viewed_at')
      .eq('member_id', memberId)
      .maybeSingle(),
  ]);

  const collectedRows = (collectedRes.data ?? []).map((r) => ({
    member_id: r.collected_member_id as number,
    created_at: r.created_at as string,
    source: r.source as 'public' | 'qr',
  }));
  const collectorRows = (collectorsRes.data ?? []).map((r) => ({
    member_id: r.collector_member_id as number,
    created_at: r.created_at as string,
    source: r.source as 'public' | 'qr',
  }));

  const lastViewedAt: string | null = profileRes.data?.collections_last_viewed_at ?? null;

  const [collected, collectors] = await Promise.all([
    hydrateEntries(collectedRows),
    hydrateEntries(collectorRows, { unreadSince: lastViewedAt }),
  ]);

  const unreadCount = collectors.filter((c) => c.is_unread).length;
  return { collected, collectors, unreadCount };
}

export async function createCollection(params: {
  collectorMemberId: number;
  collectedMemberId: number;
  source: 'public' | 'qr';
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabaseServer) return { ok: false, error: 'no_db' };
  if (params.collectorMemberId === params.collectedMemberId) {
    return { ok: false, error: 'self_collect' };
  }
  const { error } = await supabaseServer
    .from('member_collections')
    .upsert(
      {
        collector_member_id: params.collectorMemberId,
        collected_member_id: params.collectedMemberId,
        source: params.source,
      },
      { onConflict: 'collector_member_id,collected_member_id', ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeCollection(params: {
  collectorMemberId: number;
  collectedMemberId: number;
}): Promise<void> {
  if (!supabaseServer) return;
  await supabaseServer
    .from('member_collections')
    .delete()
    .eq('collector_member_id', params.collectorMemberId)
    .eq('collected_member_id', params.collectedMemberId);
}

export async function markCollectionsViewed(memberId: number): Promise<void> {
  if (!supabaseServer) return;
  await supabaseServer
    .from('member_profiles')
    .upsert(
      { member_id: memberId, collections_last_viewed_at: new Date().toISOString() },
      { onConflict: 'member_id' },
    );
}

export async function isMemberPublic(memberId: number): Promise<boolean> {
  if (!supabaseServer) return false;
  const { data } = await supabaseServer
    .from('member_profiles')
    .select('is_public')
    .eq('member_id', memberId)
    .maybeSingle();
  return !!data?.is_public;
}
