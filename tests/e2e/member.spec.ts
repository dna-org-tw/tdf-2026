import { test, expect } from '@playwright/test';

test('member dashboard renders passport for authenticated user', async ({ page }) => {
  await page.goto('/me');

  // Public toggle + sign out + passport card all live inside max-w-2xl
  const passport = page.locator('main .rounded-2xl').first();
  await expect(passport).toBeVisible();

  // Sign out button should be present
  await expect(page.getByRole('button', { name: /logout|登出/i })).toBeVisible();
});
