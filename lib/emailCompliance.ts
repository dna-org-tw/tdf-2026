import { supabaseServer } from '@/lib/supabaseServer';
import { generateUnsubscribeToken } from '@/lib/email';
import type { EmailType } from '@/lib/emailLog';

/**
 * Email types that are transactional: sent in direct response to a user action
 * (login attempt, purchase, unsubscribe click). These MUST reach the recipient
 * regardless of suppression status — a login code to an unsubscribed user is
 * still the user's own request to access their account.
 */
export const TRANSACTIONAL_EMAIL_TYPES: readonly EmailType[] = [
  'magic_link',
  'order_success',
  'order_cancelled',
  'unsubscribe_confirmation',
] as const;

export function isTransactionalEmailType(type: EmailType): boolean {
  return TRANSACTIONAL_EMAIL_TYPES.includes(type);
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const PHYSICAL_ADDRESS =
  process.env.EMAIL_PHYSICAL_ADDRESS?.trim() ||
  '2F.-1, No. 72, Sec. 1, Zhongxiao W. Rd., Zhongzheng Dist., Taipei City 100, Taiwan';

const SENDER_ORG =
  process.env.EMAIL_SENDER_ORG?.trim() || 'Taiwan Digital Fest 2026';

export interface ComplianceFooterOptions {
  email?: string;
  includeUnsubscribe?: boolean;
}

/** User-facing unsubscribe URL (renders a confirmation page). */
export function getUnsubscribeUrl(email: string): string {
  const token = generateUnsubscribeToken(email);
  return `${baseUrl}/newsletter/unsubscribe?token=${token}`;
}

/**
 * One-click POST target for the RFC 8058 `List-Unsubscribe` header.
 * Mail clients (Gmail, Yahoo, Apple Mail) POST here with
 * `List-Unsubscribe=One-Click` in the body — must return 2xx without
 * requiring a landing page.
 */
export function getOneClickUnsubscribeUrl(email: string): string {
  const token = generateUnsubscribeToken(email);
  return `${baseUrl}/api/newsletter/unsubscribe?token=${token}`;
}

export function buildComplianceFooterHtml(opts: ComplianceFooterOptions): string {
  const { email, includeUnsubscribe = true } = opts;

  let unsubscribeLine = '';
  if (includeUnsubscribe && email) {
    const url = getUnsubscribeUrl(email);
    unsubscribeLine = `
    <p style="margin: 8px 0;">
      <a href="${url}" style="color: #999; text-decoration: underline;">Unsubscribe</a>
    </p>`;
  }

  return `
  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 24px; padding: 16px; border-top: 1px solid #eee;">
    <p style="margin: 8px 0;">This is an automated email. Please do not reply directly to this message.</p>${unsubscribeLine}
    <p style="margin: 8px 0; line-height: 1.5;">
      <strong>${SENDER_ORG}</strong><br>
      ${PHYSICAL_ADDRESS}
    </p>
  </div>`;
}

export function buildComplianceFooterText(opts: ComplianceFooterOptions): string {
  const { email, includeUnsubscribe = true } = opts;
  const lines = ['---', 'This is an automated email. Please do not reply directly to this message.'];

  if (includeUnsubscribe && email) {
    lines.push(`Unsubscribe: ${getUnsubscribeUrl(email)}`);
  }

  lines.push('');
  lines.push(SENDER_ORG);
  lines.push(PHYSICAL_ADDRESS);

  return lines.join('\n');
}

export interface ComplianceHeaderOptions {
  unsubscribeEmail?: string; // if provided, adds one-click List-Unsubscribe
  replyTo?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
  tag?: string;
}

/**
 * Build Mailgun message headers/options that keep us compliant with:
 *   - RFC 8058 one-click unsubscribe (required by Gmail/Yahoo bulk-sender rules)
 *   - Mailgun tag for per-stream deliverability monitoring
 *   - Open/click tracking (when enabled per-message)
 */
export function buildMailgunComplianceOptions(
  opts: ComplianceHeaderOptions,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};

  if (opts.unsubscribeEmail) {
    const url = getOneClickUnsubscribeUrl(opts.unsubscribeEmail);
    out['h:List-Unsubscribe'] = `<${url}>, <mailto:unsubscribe@${extractDomain(baseUrl)}?subject=unsubscribe>`;
    out['h:List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  if (opts.replyTo) {
    out['h:Reply-To'] = opts.replyTo;
  }

  if (opts.trackOpens !== false) {
    out['o:tracking-opens'] = 'yes';
  }
  if (opts.trackClicks !== false) {
    out['o:tracking-clicks'] = 'yes';
  }

  if (opts.tag) {
    out['o:tag'] = opts.tag;
  }

  return out;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'example.com';
  }
}

/**
 * Check whether an email is on the suppression list (unsubscribed / bounced / complained).
 * Use before any outbound send to avoid wasting quota + damaging sender reputation.
 *
 * Pass `emailType` for transactional sends (login codes, order receipts) — these
 * always return `false` so the user still receives account-critical mail.
 */
export async function isSuppressed(
  email: string,
  emailType?: EmailType,
): Promise<boolean> {
  if (emailType && isTransactionalEmailType(emailType)) return false;
  if (!supabaseServer) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return true;

  const { data, error } = await supabaseServer
    .from('email_suppressions')
    .select('email')
    .eq('email', normalized)
    .limit(1);

  if (error) {
    console.error('[EmailCompliance] isSuppressed lookup failed:', error);
    return false; // fail-open — we'd rather send than be blocked by a flaky DB
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Bulk suppression filter. Returns the input emails split into allowed / suppressed.
 */
export async function filterSuppressed(
  emails: string[],
): Promise<{ allowed: string[]; suppressed: string[] }> {
  if (!supabaseServer || emails.length === 0) {
    return { allowed: emails, suppressed: [] };
  }
  const normalized = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  );

  const { data, error } = await supabaseServer
    .from('email_suppressions')
    .select('email')
    .in('email', normalized);

  if (error) {
    console.error('[EmailCompliance] filterSuppressed lookup failed:', error);
    return { allowed: emails, suppressed: [] };
  }

  const suppressedSet = new Set((data ?? []).map((r) => r.email));
  const allowed: string[] = [];
  const suppressed: string[] = [];
  for (const e of normalized) {
    if (suppressedSet.has(e)) suppressed.push(e);
    else allowed.push(e);
  }
  return { allowed, suppressed };
}

// Deliverability signals from the mail provider must outrank user-initiated
// unsubscribes. If a user later "unsubscribes" an address that was already
// bouncing or marked as spam, we keep the original reason so we don't lose
// the deliverability history when audits/exports look at the suppression set.
const STRONGER_REASONS = new Set(['bounced', 'complained', 'spam']);

/**
 * Upsert an email into the suppression list.
 *
 * If a stronger deliverability signal (bounced/complained/spam) is already
 * recorded for this email, an incoming `unsubscribed`/`manual` signal will
 * NOT overwrite the reason — only the timestamp/source/metadata refresh.
 */
export async function addSuppression(
  email: string,
  reason: 'unsubscribed' | 'bounced' | 'complained' | 'spam' | 'manual',
  source?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!supabaseServer) return;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const { data: existing } = await supabaseServer
    .from('email_suppressions')
    .select('reason')
    .eq('email', normalized)
    .maybeSingle();

  const incomingIsStronger = STRONGER_REASONS.has(reason);
  const existingIsStronger = existing ? STRONGER_REASONS.has(existing.reason) : false;
  const effectiveReason = existingIsStronger && !incomingIsStronger
    ? existing!.reason
    : reason;

  const { error } = await supabaseServer.from('email_suppressions').upsert(
    {
      email: normalized,
      reason: effectiveReason,
      source: source ?? null,
      metadata: metadata ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email' },
  );

  if (error) {
    console.error('[EmailCompliance] addSuppression failed:', error);
  }
}

export function getPhysicalAddress(): string {
  return PHYSICAL_ADDRESS;
}

export function getSenderOrg(): string {
  return SENDER_ORG;
}
