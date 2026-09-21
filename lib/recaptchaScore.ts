/**
 * reCAPTCHA Enterprise minimum score threshold.
 *
 * Score range 0.0 (likely bot) – 1.0 (likely human).
 * Google docs recommend 0.5 as the default cut; sensitive actions
 * (payments, voting, auth emails) should use 0.7+.
 *
 * Override per deployment via RECAPTCHA_MIN_SCORE env.
 */
const DEFAULT_MIN_SCORE = 0.7;

export function getMinRecaptchaScore(): number {
  const raw = process.env.RECAPTCHA_MIN_SCORE;
  if (!raw) return DEFAULT_MIN_SCORE;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    console.warn(`[recaptcha] Invalid RECAPTCHA_MIN_SCORE=${raw}, falling back to ${DEFAULT_MIN_SCORE}`);
    return DEFAULT_MIN_SCORE;
  }
  return parsed;
}
