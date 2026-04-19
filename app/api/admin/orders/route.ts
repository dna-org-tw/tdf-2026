import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { createManualOrder, OrderActionError } from '@/lib/orderActions';

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
  const tier = searchParams.get('tier') || '';
  const status = searchParams.get('status') || '';
  const hasCustomer = searchParams.get('hasCustomer') === '1';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  try {
    let query = supabaseServer
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }
    if (tier) {
      query = query.eq('ticket_tier', tier);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (hasCustomer) {
      query = query.not('customer_email', 'is', null);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[Admin Orders]', error);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({
      orders: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error('[Admin Orders]', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

const VALID_TIERS = ['explore', 'contribute', 'weekly_backer', 'backer'] as const;
const VALID_WEEKS = ['week1', 'week2', 'week3', 'week4'] as const;

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (!body?.customer_email || typeof body.customer_email !== 'string') {
    return NextResponse.json({ error: 'customer_email required' }, { status: 400 });
  }
  if (!VALID_TIERS.includes(body.ticket_tier)) {
    return NextResponse.json({ error: 'invalid ticket_tier' }, { status: 400 });
  }
  if (body.ticket_tier === 'weekly_backer' && !VALID_WEEKS.includes(body.week)) {
    return NextResponse.json({ error: 'week required for weekly_backer' }, { status: 400 });
  }
  let amountCents = 0;
  if (body.amount_cents !== undefined && body.amount_cents !== null && body.amount_cents !== '') {
    const n = Number(body.amount_cents);
    if (!Number.isInteger(n) || n < 0) {
      return NextResponse.json({ error: 'amount_cents must be a non-negative integer' }, { status: 400 });
    }
    amountCents = n;
  }
  const rawName = typeof body.customer_name === 'string' ? body.customer_name.trim() : '';
  const customerName = rawName || body.customer_email.split('@')[0];

  try {
    const order = await createManualOrder(
      {
        customer_email: body.customer_email,
        customer_name: customerName,
        ticket_tier: body.ticket_tier,
        week: body.week,
        amount_cents: amountCents,
        payment_reference: body.payment_reference,
        note: body.note,
      },
      session.email,
    );
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[POST manual create]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
