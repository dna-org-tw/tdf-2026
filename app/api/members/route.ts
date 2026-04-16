import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  try {
    // Get all public member profiles joined with members
    // Supabase doesn't support joins easily via JS client, so we do two queries
    let profileQuery = supabaseServer
      .from('member_profiles')
      .select('member_id, display_name, bio, avatar_url, location, tags, languages, social_links', { count: 'exact' })
      .eq('is_public', true)
      .order('member_id', { ascending: false });

    // Apply search filter if query exists
    if (q) {
      // Search across display_name, bio, location, and tags
      profileQuery = profileQuery.or(
        `display_name.ilike.%${q}%,bio.ilike.%${q}%,location.ilike.%${q}%,tags.cs.{${q}}`
      );
    }

    const { data: profiles, count, error: pErr } = await profileQuery
      .range(offset, offset + PAGE_SIZE - 1);
    if (pErr) throw pErr;
    if (!profiles?.length) {
      return NextResponse.json({ members: [], total: 0, page, pageSize: PAGE_SIZE });
    }

    // Fetch member_no for these profiles
    const memberIds = profiles.map((p) => p.member_id);
    const { data: members, error: mErr } = await supabaseServer
      .from('members')
      .select('id, member_no')
      .in('id', memberIds);
    if (mErr) throw mErr;

    const memberMap = new Map((members ?? []).map((m) => [m.id, m.member_no]));

    // Fetch tier info from enriched view
    const memberNos = (members ?? []).map((m) => m.member_no);
    const { data: enriched } = await supabaseServer
      .from('members_enriched')
      .select('member_no, highest_ticket_tier')
      .in('member_no', memberNos);

    const tierMap = new Map((enriched ?? []).map((e) => [
      e.member_no,
      e.highest_ticket_tier || 'follower',
    ]));

    const result = profiles.map((p) => {
      const memberNo = memberMap.get(p.member_id) ?? null;
      return {
        member_no: memberNo,
        display_name: p.display_name,
        bio: p.bio,
        avatar_url: p.avatar_url,
        location: p.location,
        tags: p.tags,
        languages: p.languages,
        social_links: p.social_links,
        tier: memberNo ? (tierMap.get(memberNo) ?? 'follower') : 'follower',
      };
    });

    return NextResponse.json({
      members: result,
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (e) {
    console.error('[Members List]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
