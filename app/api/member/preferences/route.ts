import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSessionFromRequest } from '@/lib/auth';

type Category = 'newsletter' | 'events' | 'award';
const VALID_CATEGORIES: readonly Category[] = ['newsletter', 'events', 'award'];

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

interface PreferencesPayload {
  email: string;
  unsubscribed: boolean;
  preferences: Record<Category, boolean>;
  hasSubscriptionRow: boolean;
}

async function fetchPreferences(email: string): Promise<PreferencesPayload> {
  if (!supabaseServer) throw new Error('Database not configured');
  const { data, error } = await supabaseServer
    .from('newsletter_subscriptions')
    .select('pref_newsletter, pref_events, pref_award, unsubscribed_at')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    // No subscription row yet — treat as fully opted-in for display.
    return {
      email,
      unsubscribed: false,
      preferences: { newsletter: true, events: true, award: true },
      hasSubscriptionRow: false,
    };
  }
  return {
    email,
    unsubscribed: !!data.unsubscribed_at,
    preferences: {
      newsletter: data.pref_newsletter !== false,
      events: data.pref_events !== false,
      award: data.pref_award !== false,
    },
    hasSubscriptionRow: true,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await fetchPreferences(normalizeEmail(session.email));
    return NextResponse.json(result);
  } catch (e) {
    console.error('[Member Preferences GET]', e);
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const email = normalizeEmail(session.email);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const unsubscribeAll = (body as { unsubscribeAll?: unknown }).unsubscribeAll === true;
  let prefRow: Record<string, boolean | string | null> = {};

  if (unsubscribeAll) {
    prefRow = { unsubscribed_at: new Date().toISOString() };
  } else {
    const prefsInput = (body as { preferences?: Record<string, unknown> }).preferences;
    if (!prefsInput || typeof prefsInput !== 'object') {
      return NextResponse.json({ error: 'preferences object required' }, { status: 400 });
    }
    for (const cat of VALID_CATEGORIES) {
      if (typeof prefsInput[cat] !== 'boolean') {
        return NextResponse.json({ error: `preferences.${cat} must be boolean` }, { status: 400 });
      }
    }
    prefRow = {
      unsubscribed_at: null,
      pref_newsletter: prefsInput.newsletter as boolean,
      pref_events: prefsInput.events as boolean,
      pref_award: prefsInput.award as boolean,
    };
  }

  const { data: existing, error: existingErr } = await supabaseServer
    .from('newsletter_subscriptions')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingErr) {
    console.error('[Member Preferences PATCH] existing lookup:', existingErr);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }

  if (existing) {
    const { error: updateErr } = await supabaseServer
      .from('newsletter_subscriptions')
      .update(prefRow)
      .eq('id', existing.id);
    if (updateErr) {
      console.error('[Member Preferences PATCH] update:', updateErr);
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }
  } else {
    const insertRow = {
      email,
      source: 'member_preferences',
      created_at: new Date().toISOString(),
      ...prefRow,
    };
    const { error: insertErr } = await supabaseServer
      .from('newsletter_subscriptions')
      .insert(insertRow);
    if (insertErr) {
      console.error('[Member Preferences PATCH] insert:', insertErr);
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }
  }

  // If the user is opting back in to anything, drop only the 'unsubscribed'
  // suppression — preserve bounces/complaints (deliverability signals must
  // survive a re-opt-in, mirroring the homepage subscribe flow).
  if (!unsubscribeAll) {
    const { data: existingSuppression } = await supabaseServer
      .from('email_suppressions')
      .select('reason')
      .eq('email', email)
      .maybeSingle();
    if (existingSuppression && existingSuppression.reason === 'unsubscribed') {
      await supabaseServer
        .from('email_suppressions')
        .delete()
        .eq('email', email)
        .eq('reason', 'unsubscribed');
    }
  }

  const result = await fetchPreferences(email);
  return NextResponse.json(result);
}
