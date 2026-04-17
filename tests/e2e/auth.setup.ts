import { test as setup, expect } from '@playwright/test';

const STORAGE_PATH = '.auth/session.json';
const TEST_EMAIL = process.env.E2E_EMAIL ?? 'kk@dna.org.tw';

setup('authenticate via dev-signin', async ({ page }) => {
  const secret = process.env.DEV_SIGNIN_SECRET;
  if (!secret) {
    throw new Error('DEV_SIGNIN_SECRET is not set. Add it to .env.local to run E2E.');
  }

  // page.request shares the browser context, so Set-Cookie from the response
  // persists into the same cookie jar that storageState will capture below.
  const res = await page.request.post('/api/auth/dev-signin', {
    headers: { 'x-dev-signin-secret': secret },
    data: { email: TEST_EMAIL },
  });
  expect(res.status(), 'dev-signin should return 200').toBe(200);

  // Confirm the cookie authenticates us before saving state.
  await page.goto('/me');
  await expect(page.getByRole('button', { name: /sign out|登出/i })).toBeVisible({ timeout: 15_000 });

  await page.context().storageState({ path: STORAGE_PATH });
});
