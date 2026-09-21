import { NextRequest } from 'next/server';
import { getSessionFromRequest, type SessionPayload } from '@/lib/auth';

const ADMIN_EMAIL_DOMAIN = process.env.ADMIN_EMAIL_DOMAIN || 'dna.org.tw';

export function isAdminEmail(email: string): boolean {
  return email.endsWith(`@${ADMIN_EMAIL_DOMAIN}`);
}

export async function getAdminSession(req: NextRequest): Promise<SessionPayload | null> {
  const session = await getSessionFromRequest(req);
  if (!session) return null;
  if (!isAdminEmail(session.email)) return null;
  return session;
}
