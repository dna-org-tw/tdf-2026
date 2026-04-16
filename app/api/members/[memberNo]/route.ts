import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ memberNo: string }> },
) {
  const { memberNo: member_no } = await params;
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  // Validate member_no format (M + digits)
  if (!/^M\d+$/.test(member_no)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    // Fetch member + profile in one query via join
    const { data: member, error: mErr } = await supabaseServer
      .from('members')
      .select('id, member_no, first_seen_at')
      .eq('member_no', member_no)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!member) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: profile, error: pErr } = await supabaseServer
      .from('member_profiles')
      .select('display_name, bio, avatar_url, location, timezone, tags, languages, social_links, is_public')
      .eq('member_id', member.id)
      .maybeSingle();
    if (pErr) throw pErr;

    // Only return data if profile is public
    if (!profile?.is_public) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Get the member's ticket tier from enriched view
    const { data: enriched } = await supabaseServer
      .from('members_enriched')
      .select('active_ticket_tier, highest_ticket_tier, earliest_valid_from, latest_valid_until')
      .eq('member_no', member_no)
      .maybeSingle();

    return NextResponse.json({
      member_no: member.member_no,
      first_seen_at: member.first_seen_at,
      display_name: profile.display_name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      location: profile.location,
      timezone: profile.timezone,
      tags: profile.tags,
      languages: profile.languages,
      social_links: profile.social_links,
      tier: enriched?.active_ticket_tier || enriched?.highest_ticket_tier || 'follower',
      valid_from: enriched?.earliest_valid_from ?? null,
      valid_until: enriched?.latest_valid_until ?? null,
    });
  } catch (e) {
    console.error('[Public Member Profile]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
