import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = process.env.LUMA_COOKIE_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('LUMA_COOKIE_ENCRYPTION_KEY must be 32-byte hex (64 chars)');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptCookie(plain: string): { enc: Buffer; iv: Buffer; tag: Buffer; last4: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const last4 = plain.slice(-4);
  return { enc, iv, tag, last4 };
}

export function decryptCookie(enc: Buffer, iv: Buffer, tag: Buffer): string {
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
