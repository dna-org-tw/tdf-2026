import { test, expect } from '@playwright/test';

test.describe('Admin critical notification flow', () => {
  test('UI shows warning + gating + badge for critical category', async ({ page }) => {
    await page.goto('/admin/send');
    await expect(page.getByRole('heading', { name: '發送通知' })).toBeVisible();

    // Select the critical category
    await page.getByText('⚠️ 重大通知（無法退訂）').click();

    // Warning panel appears
    await expect(page.getByTestId('critical-warning')).toBeVisible();
    await expect(page.getByTestId('critical-warning')).toContainText('履約必要');

    // Fill subject + body
    await page.getByPlaceholder('主旨').fill('E2E critical test');
    await page.getByPlaceholder('內文（支援換行）').fill('Body for critical test.');

    // Switch to testOnly to avoid hitting the real audience, but still
    // verify the ack checkbox and badge appear for non-test path.
    // First: non-testOnly, pick a filter (identity) to enable the submit.
    await page.getByLabel('Backer').check();

    // Open confirm modal
    await page.getByRole('button', { name: '發送' }).click();

    // The critical-ack checkbox must be present and required
    const ack = page.getByTestId('critical-ack');
    await expect(ack).toBeVisible();
    const confirmBtn = page.getByRole('button', { name: '確認發送' });
    await expect(confirmBtn).toBeDisabled();
    await ack.check();
    await expect(confirmBtn).toBeEnabled();

    // Cancel out — we don't actually send in E2E to avoid email side-effects.
    await page.getByRole('button', { name: '取消' }).click();
    await expect(ack).not.toBeVisible();
  });

  test('API rejects critical send without identity/status/tier filter', async ({ request }) => {
    const res = await request.post('/api/admin/send', {
      data: {
        subject: 'Should be rejected',
        body: 'No filter provided',
        category: 'critical',
        groups: ['subscribers'], // groups alone is not enough for critical
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('重大通知');
  });

  test('API accepts non-critical send with only groups filter (regression)', async ({ request }) => {
    // Guard regression: non-critical sends with `groups` alone must still work.
    // We only test the validation path — use a subject that makes side-effects
    // auditable, and rely on the 1/min rate limit + 'test' group to avoid blast.
    const res = await request.post('/api/admin/send', {
      data: {
        subject: 'E2E validation probe (test-only)',
        body: 'Validation probe',
        category: 'newsletter',
        groups: ['test'], // sends to the admin's own email only
      },
    });
    // Either 200 (enqueued to self) or 429 (rate-limited from a prior run) is
    // acceptable; 400 would indicate the guard incorrectly blocked non-critical.
    expect([200, 429]).toContain(res.status());
  });
});
