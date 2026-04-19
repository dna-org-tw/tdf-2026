import { expect, test } from '@playwright/test';

test('guide page renders dual entry cards and grouped quick nav', async ({ page }) => {
  await page.goto('/guide?lang=zh');

  await expect(page.getByRole('heading', { name: /完整指南|參與指南/ })).toBeVisible();
  await expect(page.getByRole('link', { name: '活動指南' })).toBeVisible();
  await expect(page.getByRole('link', { name: '會員指南' })).toBeVisible();
  await expect(page.getByRole('link', { name: '票券與參與' })).toBeVisible();
  await expect(page.getByRole('link', { name: '會員是什麼' })).toBeVisible();
  await expect(page.getByRole('link', { name: '合作住宿' })).toBeVisible();
  await expect(page.getByRole('link', { name: '簽證輔助文件' })).toBeVisible();
});

test('guide deep link and homepage FAQ target the new section ids', async ({ page }) => {
  await page.goto('/guide?lang=zh#member-guide');
  await expect(page.locator('#member-guide')).toBeInViewport();

  await page.goto('/?lang=zh');
  await expect(page.locator('a[href="/guide#event-registration"]').first()).toBeVisible();
});
