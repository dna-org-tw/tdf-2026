import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSessionFromRequest } from '@/lib/auth';

const MAX_DISPLAY_NAME = 50;
const MAX_LOCATION = 100;
const MAX_NATIONALITY = 80;

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

type Values = {
  email: string;
  display_name: string | null;
  location: string | null;
  nationality: string | null;
  work_types: string[];
  nomad_experience: string | null;
};

function computeMissing(v: Values): string[] {
  const missing: string[] = [];
  if (!v.display_name?.trim()) missing.push('display_name');
  if (!v.nationality?.trim()) missing.push('nationality');
  if (!v.work_types || v.work_types.length === 0) missing.push('work_types');
  if (!v.nomad_experience) missing.push('nomad_experience');
  if (!v.location?.trim()) missing.push('location');
  return missing;
}

async function ensureMember(email: string) {
  if (!supabaseServer) throw new Error('Database not configured');
  const normalized = email.trim().toLowerCase();
  const { data: existing, error } = await supabaseServer
    .from('members')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id as number;

  const { data: created, error: cErr } = await supabaseServer
    .from('members')
    .upsert({ email: normalized }, { onConflict: 'email' })
    .select('id')
    .single();
  if (cErr) throw cErr;
  return created.id as number;
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
    const normalized = session.email.trim().toLowerCase();
    const { data: member } = await supabaseServer
      .from('members')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();

    let row: Partial<Values> & { display_name?: string | null } = {};
    if (member) {
      const { data } = await supabaseServer
        .from('member_profiles')
        .select('display_name, location, nationality, work_types, nomad_experience')
        .eq('member_id', member.id)
        .maybeSingle();
      row = data ?? {};
    }

    // Fall back to the enriched view's name (e.g. from a past order's customer_name)
    let fallbackName: string | null = null;
    if (!row.display_name) {
      const { data: enriched } = await supabaseServer
        .from('members_enriched')
        .select('name')
        .ilike('email', session.email)
        .maybeSingle();
      fallbackName = enriched?.name ?? null;
    }

    const values: Values = {
      email: session.email,
      display_name: row.display_name ?? fallbackName ?? null,
      location: row.location ?? null,
      nationality: row.nationality ?? null,
      work_types: Array.isArray(row.work_types) ? row.work_types : [],
      nomad_experience: row.nomad_experience ?? null,
    };

    // For completeness check, ignore the prefilled name (it isn't persisted yet)
    const persisted: Values = { ...values, display_name: row.display_name ?? null };
    const missing = computeMissing(persisted);

    return NextResponse.json({
      complete: missing.length === 0,
      missing,
      values,
    });
  } catch (e) {
    console.error('[Profile Completion GET]', e);
    return NextResponse.json({ error: 'Failed to load completion status' }, { status: 500 });
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

  // Validate
  const display_name = typeof body.display_name === 'string'
    ? body.display_name.trim().slice(0, MAX_DISPLAY_NAME)
    : '';
  const location = typeof body.location === 'string'
    ? body.location.trim().slice(0, MAX_LOCATION)
    : '';
  const nationality = typeof body.nationality === 'string'
    ? body.nationality.trim().slice(0, MAX_NATIONALITY)
    : '';
  const allowedWork = ALLOWED_WORK_TYPES as readonly string[];
  const work_types = Array.isArray(body.work_types)
    ? Array.from(new Set(
        body.work_types.filter((t: unknown): t is string => typeof t === 'string' && allowedWork.includes(t)),
      ))
    : [];
  const nomad_experience = typeof body.nomad_experience === 'string'
      && (ALLOWED_NOMAD_EXPERIENCE as readonly string[]).includes(body.nomad_experience)
    ? body.nomad_experience
    : null;

  const errors: Record<string, string> = {};
  if (!display_name) errors.display_name = 'required';
  if (!nationality) errors.nationality = 'required';
  if (work_types.length === 0) errors.work_types = 'required';
  if (!nomad_experience) errors.nomad_experience = 'required';
  if (!location) errors.location = 'required';

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
  }

  try {
    const memberId = await ensureMember(session.email);

    const update = {
      member_id: memberId,
      display_name,
      location,
      nationality,
      work_types,
      nomad_experience,
    };

    const { error } = await supabaseServer
      .from('member_profiles')
      .upsert(update, { onConflict: 'member_id' });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[Profile Completion PUT]', e);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}
