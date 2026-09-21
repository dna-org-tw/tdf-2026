import { getMinRecaptchaScore } from '@/lib/recaptchaScore';

const recaptchaApiKey = process.env.RECAPTCHA_API_KEY;
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6Lcu81gsAAAAAIrVoGK7urIEt9_w7gOoUSjzC5Uv';
const recaptchaProjectId = process.env.RECAPTCHA_PROJECT_ID || 'tdna-1769599168858';

export type RecaptchaResult =
  | { ok: true; score: number | null }
  | { ok: false; reason: 'not_configured' | 'missing_token' | 'invalid' | 'low_score' | 'api_error' };

/**
 * Verify a reCAPTCHA Enterprise token against Google's assessment API.
 * Rejects tokens that fail tokenProperties.valid or whose action doesn't match.
 * Rejects scores below the threshold from getMinRecaptchaScore (default 0.7,
 * override with RECAPTCHA_MIN_SCORE env). Fails closed on HTTP or network errors.
 */
export async function verifyRecaptcha(
  token: string | undefined,
  expectedAction: string
): Promise<RecaptchaResult> {
  if (!recaptchaApiKey) {
    console.error('[reCAPTCHA] RECAPTCHA_API_KEY is not configured.');
    return { ok: false, reason: 'not_configured' };
  }
  if (!token) {
    return { ok: false, reason: 'missing_token' };
  }

  try {
    const response = await fetch(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${recaptchaProjectId}/assessments?key=${recaptchaApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: { token, expectedAction, siteKey: recaptchaSiteKey },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[reCAPTCHA Enterprise] API error:', errorData);
      return { ok: false, reason: 'api_error' };
    }

    const data = await response.json();
    if (!data.tokenProperties?.valid || data.tokenProperties?.action !== expectedAction) {
      return { ok: false, reason: 'invalid' };
    }

    const score: number | undefined = data.riskAnalysis?.score;
    if (score !== undefined) {
      const minScore = getMinRecaptchaScore();
      if (score < minScore) {
        console.warn(`[reCAPTCHA] ${expectedAction} rejected, score ${score} < ${minScore}`);
        return { ok: false, reason: 'low_score' };
      }
    }

    return { ok: true, score: score ?? null };
  } catch (error) {
    console.error('[reCAPTCHA Enterprise] Verification error:', error);
    return { ok: false, reason: 'api_error' };
  }
}
