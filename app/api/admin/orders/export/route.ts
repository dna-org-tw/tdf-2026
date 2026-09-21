import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { csvEscape } from '@/lib/csv';

interface OrderRow {
  id: string;
  stripe_session_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  ticket_tier: string | null;
  status: string | null;
  amount_total: number | null;
  amount_discount: number | null;
  discount_code: string | null;
  currency: string | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  created_at: string;
}

function formatAmount(amount: number | null): string {
  if (amount === null || amount === undefined) return '';
  return (amount / 100).toFixed(2);
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
  const tier = searchParams.get('tier') || '';
  const status = searchParams.get('status') || '';
  const hasCustomer = searchParams.get('hasCustomer') === '1';
  const discountCode = searchParams.get('discount_code')?.trim() || '';

  const pageSize = 1000;
  const rows: OrderRow[] = [];
  let offset = 0;

  try {
    while (true) {
      let query = supabaseServer
        .from('orders')
        .select('id, stripe_session_id, customer_email, customer_name, ticket_tier, status, amount_total, amount_discount, discount_code, currency, payment_method_brand, payment_method_last4, created_at')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (search) {
        query = query.or(`customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`);
      }
      if (tier) query = query.eq('ticket_tier', tier);
      if (status) query = query.eq('status', status);
      if (hasCustomer) query = query.not('customer_email', 'is', null);
      if (discountCode) query = query.eq('discount_code', discountCode);

      const { data, error } = await query;
      if (error) {
        console.error('[Admin Orders Export]', error);
        return NextResponse.json({ error: 'Failed to export orders' }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      rows.push(...(data as OrderRow[]));
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    const header = [
      'id',
      'stripe_session_id',
      'customer_email',
      'customer_name',
      'ticket_tier',
      'status',
      'amount_total',
      'amount_discount',
      'discount_code',
      'currency',
      'payment_method_brand',
      'payment_method_last4',
      'created_at',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        csvEscape(r.id),
        csvEscape(r.stripe_session_id),
        csvEscape(r.customer_email),
        csvEscape(r.customer_name),
        csvEscape(r.ticket_tier),
        csvEscape(r.status),
        csvEscape(formatAmount(r.amount_total)),
        csvEscape(formatAmount(r.amount_discount)),
        csvEscape(r.discount_code),
        csvEscape(r.currency),
        csvEscape(r.payment_method_brand),
        csvEscape(r.payment_method_last4),
        csvEscape(r.created_at),
      ].join(','));
    }
    const csv = '\uFEFF' + lines.join('\r\n');

    const ts = new Date().toISOString().slice(0, 10);
    const filename = `orders-${ts}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Admin Orders Export]', error);
    return NextResponse.json({ error: 'Failed to export orders' }, { status: 500 });
  }
}
