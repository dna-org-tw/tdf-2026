import { test, expect } from '@playwright/test';

test('member dashboard renders passport for authenticated user', async ({ page }) => {
  await page.goto('/me');

  // Dashboard header appears once auth + initial fetches settle.
  await expect(page.getByRole('button', { name: /logout|登出/i })).toBeVisible({ timeout: 15_000 });

  // Passport card lives inside main.
  const passport = page.locator('main .rounded-2xl').first();
  await expect(passport).toBeVisible();
});
