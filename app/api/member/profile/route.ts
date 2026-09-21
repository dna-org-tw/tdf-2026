import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSessionFromRequest } from '@/lib/auth';

const MAX_DISPLAY_NAME = 50;
const MAX_BIO = 280;
const MAX_LOCATION = 100;
const MAX_NATIONALITY = 80;
const MAX_TAGS = 10;
const MAX_LANGUAGES = 10;
const MAX_SOCIAL_LINKS = 10;
const ALLOWED_WORK_TYPES = [
  'admin_mgmt',
  'sales_marketing',
  'finance_legal',
  'it_engineering',
  'design_creative',
  'education_research',
  'healthcare_social',
  'tourism_hospitality',
  'manufacturing_logistics',
  'freelance_entrepreneur',
] as const;
const ALLOWED_NOMAD_EXPERIENCE = [
  'not_yet',
  'under_3m',
  '3m_to_1y',
  '1_to_3y',
  '3_to_5y',
  '5_to_10y',
  'over_10y',
] as const;

function getMemberId(email: string) {
  if (!supabaseServer) throw new Error('Database not configured');
  return supabaseServer
    .from('members')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const { data: member, error: mErr } = await getMemberId(session.email);
    if (mErr) throw mErr;
    const empty = {
      display_name: null,
      bio: null,
      avatar_url: null,
      location: null,
      timezone: null,
      tags: [],
      languages: [],
      social_links: {},
      is_public: false,
      nationality: null,
      work_types: [] as string[],
      nomad_experience: null,
      consent_activity_stats: false,
      consent_activity_stats_at: null,
    };

    if (!member) {
      return NextResponse.json(empty);
    }

    const { data, error } = await supabaseServer
      .from('member_profiles')
      .select('display_name, bio, avatar_url, location, timezone, tags, languages, social_links, is_public, nationality, work_types, nomad_experience, consent_activity_stats, consent_activity_stats_at')
      .eq('member_id', member.id)
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json(data ?? empty);
  } catch (e) {
    console.error('[Member Profile GET]', e);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  try {
    const { data: existingMember, error: mErr } = await getMemberId(session.email);
    if (mErr) throw mErr;
    // If the member row doesn't exist yet (e.g. user signed in via magic-link
    // before any order/newsletter activity), create it now.
    let member = existingMember;
    if (!member) {
      const { data: created, error: cErr } = await supabaseServer
        .from('members')
        .upsert({ email: session.email.trim().toLowerCase() }, { onConflict: 'email' })
        .select('id')
        .single();
      if (cErr) throw cErr;
      member = created;
    }

    // Build update payload with validation
    const update: Record<string, unknown> = { member_id: member.id };

    if ('display_name' in body) {
      const v = body.display_name;
      update.display_name = typeof v === 'string' ? v.trim().slice(0, MAX_DISPLAY_NAME) || null : null;
    }
    if ('bio' in body) {
      const v = body.bio;
      update.bio = typeof v === 'string' ? v.trim().slice(0, MAX_BIO) || null : null;
    }
    if ('location' in body) {
      const v = body.location;
      update.location = typeof v === 'string' ? v.trim().slice(0, MAX_LOCATION) || null : null;
    }
    if ('timezone' in body) {
      const v = body.timezone;
      update.timezone = typeof v === 'string' ? v.trim() || null : null;
    }
    if ('tags' in body) {
      const v = body.tags;
      update.tags = Array.isArray(v)
        ? v.filter((t: unknown) => typeof t === 'string' && t.trim()).map((t: string) => t.trim()).slice(0, MAX_TAGS)
        : [];
    }
    if ('languages' in body) {
      const v = body.languages;
      update.languages = Array.isArray(v)
        ? v.filter((l: unknown) => typeof l === 'string' && l.trim()).map((l: string) => l.trim()).slice(0, MAX_LANGUAGES)
        : [];
    }
    if ('social_links' in body) {
      const v = body.social_links;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const cleaned: Record<string, string> = {};
        let count = 0;
        for (const [k, val] of Object.entries(v)) {
          if (count >= MAX_SOCIAL_LINKS) break;
          if (typeof val === 'string' && val.trim()) {
            cleaned[k.trim()] = val.trim();
            count++;
          }
        }
        update.social_links = cleaned;
      } else {
        update.social_links = {};
      }
    }
    if ('is_public' in body) {
      update.is_public = body.is_public === true;
    }
    if ('nationality' in body) {
      const v = body.nationality;
      update.nationality = typeof v === 'string' ? v.trim().slice(0, MAX_NATIONALITY) || null : null;
    }
    if ('work_types' in body) {
      const v = body.work_types;
      const allowed = ALLOWED_WORK_TYPES as readonly string[];
      update.work_types = Array.isArray(v)
        ? Array.from(new Set(
            v.filter((t: unknown): t is string => typeof t === 'string' && allowed.includes(t)),
          ))
        : [];
    }
    if ('nomad_experience' in body) {
      const v = body.nomad_experience;
      update.nomad_experience = typeof v === 'string' && (ALLOWED_NOMAD_EXPERIENCE as readonly string[]).includes(v)
        ? v
        : null;
    }
    if ('consent_activity_stats' in body) {
      const v = body.consent_activity_stats === true;
      update.consent_activity_stats = v;
      update.consent_activity_stats_at = v ? new Date().toISOString() : null;
    }

    const { data, error } = await supabaseServer
      .from('member_profiles')
      .upsert(update, { onConflict: 'member_id' })
      .select('display_name, bio, avatar_url, location, timezone, tags, languages, social_links, is_public, nationality, work_types, nomad_experience, consent_activity_stats, consent_activity_stats_at')
      .single();
    if (error) throw error;

    return NextResponse.json(data);
  } catch (e) {
    console.error('[Member Profile PUT]', e);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}
