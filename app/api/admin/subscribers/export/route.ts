import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

interface SubscriberRow {
  email: string;
  source: string | null;
  country: string | null;
  timezone: string | null;
  locale: string | null;
  created_at: string;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';

  const pageSize = 1000;
  const rows: SubscriberRow[] = [];
  let offset = 0;

  try {
    while (true) {
      let query = supabaseServer
        .from('newsletter_subscriptions')
        .select('email, source, country, timezone, locale, created_at')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (search) {
        query = query.ilike('email', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[Admin Subscribers Export]', error);
        return NextResponse.json({ error: 'Failed to export subscribers' }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      rows.push(...(data as SubscriberRow[]));
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    const header = ['email', 'source', 'country', 'timezone', 'locale', 'created_at'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        csvEscape(r.email),
        csvEscape(r.source),
        csvEscape(r.country),
        csvEscape(r.timezone),
        csvEscape(r.locale),
        csvEscape(r.created_at),
      ].join(','));
    }
    const csv = '\uFEFF' + lines.join('\r\n');

    const ts = new Date().toISOString().slice(0, 10);
    const filename = `subscribers-${ts}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Admin Subscribers Export]', error);
    return NextResponse.json({ error: 'Failed to export subscribers' }, { status: 500 });
  }
}
