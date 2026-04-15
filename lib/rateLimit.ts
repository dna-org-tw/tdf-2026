/**
 * Persistent rate limiter backed by a Postgres function (Supabase).
 *
 * Atomic increment + window reset happens server-side via the
 * `check_rate_limit` RPC — see supabase/migrations/create_rate_limits_table.sql.
 *
 * Behaviour on RPC failure:
 *   - falls back to an in-process Map so local dev and misconfigured
 *     deployments keep working;
 *   - logs the failure loudly so it is surfaced in production.
 */

import { supabaseServer } from './supabaseServer';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Periodically clean up the in-memory fallback so we do not leak keys.
if (typeof setInterval === 'function') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (now > entry.resetAt) memoryStore.delete(key);
    }
  }, 60 * 1000).unref?.();
}

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

function memoryCheck(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + options.windowSeconds * 1000;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.limit - 1, resetAt };
  }
  if (entry.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { allowed: true, remaining: options.limit - entry.count, resetAt: entry.resetAt };
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  if (!supabaseServer) {
    return memoryCheck(key, options);
  }
  try {
    const { data, error } = await supabaseServer.rpc('check_rate_limit', {
      p_key: key,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('check_rate_limit returned no row');
    return {
      allowed: Boolean(row.allowed),
      remaining: Number(row.remaining ?? 0),
      resetAt: new Date(row.reset_at).getTime(),
    };
  } catch (err) {
    console.error('[rateLimit] Supabase RPC failed, falling back to in-memory:', err);
    return memoryCheck(key, options);
  }
}
