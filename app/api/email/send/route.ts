import { NextRequest, NextResponse } from 'next/server';
import { sendOrderEmail, type OrderEmailData, type OrderEmailType } from '@/lib/sendOrderEmail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { order, type } = body as { order: OrderEmailData; type: OrderEmailType };

    if (!order || !order.customer_email) {
      return NextResponse.json(
        { error: 'Order data and customer email are required.' },
        { status: 400 }
      );
    }

    const result = await sendOrderEmail(order, type);

    if (result.skipped) {
      return NextResponse.json({ success: true, skipped: true });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('[Email] Error sending email', error);
    return NextResponse.json(
      { error: 'Failed to send email.' },
      { status: 500 }
    );
  }
}
