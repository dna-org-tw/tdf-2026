import { randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'tdf_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

let cachedSecret: Uint8Array | null = null;

function getSecretKey(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.AUTH_SECRET;
  if (secret) {
    cachedSecret = new TextEncoder().encode(secret);
    return cachedSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET environment variable is required in production');
  }
  // Dev/test: generate an ephemeral per-process secret so sessions never leak
  // across environments sharing the old hardcoded default.
  const ephemeral = randomBytes(32).toString('hex');
  console.warn('[auth] AUTH_SECRET not set — using ephemeral per-process secret. Sessions will invalidate on restart. Set AUTH_SECRET to persist sessions.');
  cachedSecret = new TextEncoder().encode(ephemeral);
  return cachedSecret;
}

export interface SessionPayload {
  userId: string;
  email: string;
}

export async function signSessionToken(email: string, userId: string): Promise<string> {
  return new SignJWT({ email, userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.email !== 'string' || typeof payload.userId !== 'string') {
      return null;
    }
    return { email: payload.email, userId: payload.userId };
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
