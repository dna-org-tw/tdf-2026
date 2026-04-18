import { test, expect } from '@playwright/test';

test('public stay page renders rounded TWD prices and policy copy', async ({ page }) => {
  await page.route('**/api/stay/weeks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        weeks: [
          { code: '2026-w1', starts_on: '2026-04-30', ends_on: '2026-05-07', price_twd: 6125, room_capacity: 30, status: 'active', booking_open: true },
          { code: '2026-w2', starts_on: '2026-05-07', ends_on: '2026-05-14', price_twd: 4904, room_capacity: 40, status: 'active', booking_open: true },
        ],
      }),
    });
  });

  await page.goto('/stay?lang=zh');
  await expect(page.getByText(/任何取消或未到都收整週房費/)).toBeVisible();
  await expect(page.getByText(/NT\$6,125/)).toBeVisible();
  await expect(page.getByText(/NT\$4,904/)).toBeVisible();
});

test('authenticated member page shows stay summary card', async ({ page }) => {
  await page.route('**/api/stay/bookings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bookings: [], waitlist: [], transfers: [] }),
    });
  });

  await page.goto('/me');
  await expect(page.getByText(/Partner Stay|合作住宿/)).toBeVisible({ timeout: 15000 });
});
