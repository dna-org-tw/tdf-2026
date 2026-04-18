import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getMemberByEmail, getVisaProfile, upsertVisaProfile, validateVisaProfileInput } from '@/lib/memberVisa';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const member = await getMemberByEmail(session.email);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const profile = await getVisaProfile(member.id);
    return NextResponse.json(profile ?? {
      legal_name_en: null,
      nationality: null,
      date_of_birth: null,
      passport_number: null,
      passport_country: null,
      passport_expiry_date: null,
      planned_arrival_date: null,
      planned_departure_date: null,
      taiwan_stay_address: null,
      destination_mission: null,
      notes_for_letter: null,
      updated_at: null,
    });
  } catch (error) {
    console.error('[Visa Profile GET]', error);
    return NextResponse.json({ error: 'Failed to load visa profile' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = validateVisaProfileInput(body);
  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error ?? 'Invalid body' }, { status: 400 });
  }

  try {
    const member = await getMemberByEmail(session.email);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const profile = await upsertVisaProfile(member.id, parsed.data);
    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Visa Profile PUT]', error);
    return NextResponse.json({ error: 'Failed to save visa profile' }, { status: 500 });
  }
}
