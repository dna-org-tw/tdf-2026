// tests/e2e/tickets-cutoff.spec.ts
import { expect, test } from '@playwright/test';

test.describe('ticket sale cutoff UI', () => {
  test('when /api/tickets/status returns closed, banner shows and buy button is disabled', async ({ page }) => {
    await page.route('**/api/tickets/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          closed: true,
          cutoff: '2026-04-20T16:00:00.000Z',
          supportEmail: 'registration@taiwandigitalfest.com',
        }),
      }),
    );

    await page.goto('/?lang=en#tickets');

    // Banner copy (partial match on the hard-coded contact email)
    await expect(
      page.getByText(/registration@taiwandigitalfest\.com/i).first(),
    ).toBeVisible();

    // Explorer / Contributor / Backer buttons should read "Sales closed" and be disabled
    const salesClosedButtons = page.getByRole('button', { name: /sales closed/i });
    await expect(salesClosedButtons.first()).toBeVisible();
    await expect(salesClosedButtons.first()).toBeDisabled();
  });

  test('when status returns open, buy button is enabled', async ({ page }) => {
    await page.route('**/api/tickets/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          closed: false,
          cutoff: '2099-12-31T00:00:00.000Z',
          supportEmail: 'registration@taiwandigitalfest.com',
        }),
      }),
    );

    await page.goto('/?lang=en#tickets');

    const buyButtons = page.getByRole('button', { name: /pay with card|start your journey/i });
    await expect(buyButtons.first()).toBeVisible();
    await expect(buyButtons.first()).toBeEnabled();
  });
});
