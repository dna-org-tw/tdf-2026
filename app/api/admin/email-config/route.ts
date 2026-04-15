import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';

const mailgunDomain = process.env.MAILGUN_DOMAIN;
const fromRaw = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;
const fromEmail = fromRaw.includes('<') ? fromRaw : `Taiwan Digital Fest <${fromRaw}>`;
const replyToEmail = process.env.EMAIL_REPLY_TO || 'fest@dna.org.tw';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    from: fromEmail,
    replyTo: replyToEmail,
    domain: mailgunDomain || null,
  });
}
