import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyQrToken } from '@/lib/memberCollections';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ memberNo: string }> },
) {
  const { memberNo: member_no } = await params;
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  if (!/^M\d+$/.test(member_no)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('t');

  try {
    const { data: member, error: mErr } = await supabaseServer
      .from('members')
      .select('id, member_no, first_seen_at, email')
      .eq('member_no', member_no)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!member) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: profile, error: pErr } = await supabaseServer
      .from('member_profiles')
      .select('display_name, bio, avatar_url, location, timezone, tags, languages, social_links, is_public, nationality, work_types, nomad_experience')
      .eq('member_id', member.id)
      .maybeSingle();
    if (pErr) throw pErr;

    let allowed = !!profile?.is_public;
    if (!allowed && token) {
      const payload = await verifyQrToken(token);
      if (payload && payload.member_no === member_no) allowed = true;
    }
    if (!allowed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: enriched } = await supabaseServer
      .from('members_enriched')
      .select('highest_ticket_tier')
      .eq('member_no', member_no)
      .maybeSingle();

    let validFrom: string | null = null;
    let validUntil: string | null = null;
    if (member.email) {
      const { data: order } = await supabaseServer
        .from('orders')
        .select('valid_from, valid_until')
        .eq('customer_email', member.email)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      validFrom = order?.valid_from ?? null;
      validUntil = order?.valid_until ?? null;
    }

    return NextResponse.json({
      member_no: member.member_no,
      first_seen_at: member.first_seen_at,
      display_name: profile?.display_name ?? null,
      bio: profile?.bio ?? null,
      avatar_url: profile?.avatar_url ?? null,
      location: profile?.location ?? null,
      timezone: profile?.timezone ?? null,
      tags: profile?.tags ?? [],
      languages: profile?.languages ?? [],
      social_links: profile?.social_links ?? {},
      nationality: profile?.nationality ?? null,
      work_types: Array.isArray(profile?.work_types) ? profile?.work_types : [],
      nomad_experience: profile?.nomad_experience ?? null,
      tier: enriched?.highest_ticket_tier || 'follower',
      valid_from: validFrom,
      valid_until: validUntil,
      is_public: !!profile?.is_public,
    });
  } catch (e) {
    console.error('[Public Member Profile]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
