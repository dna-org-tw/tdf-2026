export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const requiredEnvVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SECRET_KEY',
      'MAILGUN_API_KEY',
      'MAILGUN_DOMAIN',
      'RECAPTCHA_API_KEY',
      'NEXT_PUBLIC_RECAPTCHA_SITE_KEY',
      'RECAPTCHA_PROJECT_ID',
      'UNSUBSCRIBE_SECRET',
      'VOTE_SECRET',
      'AUTH_SECRET',
    ];

    const missing = requiredEnvVars.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      console.error(
        `[Security] Missing critical environment variables: ${missing.join(', ')}. ` +
        'Some features will fail at runtime. See docs/superpowers/specs/2026-04-12-security-fixes-design.md for details.'
      );
    }
  }
}
