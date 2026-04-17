import { test as setup, expect } from '@playwright/test';

const STORAGE_PATH = '.auth/session.json';
const TEST_EMAIL = process.env.E2E_EMAIL ?? 'kk@dna.org.tw';

setup('authenticate via dev-signin', async ({ request, page }) => {
  const secret = process.env.DEV_SIGNIN_SECRET;
  if (!secret) {
    throw new Error('DEV_SIGNIN_SECRET is not set. Add it to .env.local to run E2E.');
  }

  const res = await request.post('/api/auth/dev-signin', {
    headers: { 'x-dev-signin-secret': secret },
    data: { email: TEST_EMAIL },
  });
  expect(res.status(), 'dev-signin should return 200').toBe(200);

  await page.goto('/me');
  await expect(page).toHaveURL(/\/me/);

  await page.context().storageState({ path: STORAGE_PATH });
});
