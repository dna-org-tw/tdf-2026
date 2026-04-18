import { expect, test } from '@playwright/test';

test('member can save visa details and download a visa support letter', async ({ page }) => {
  await page.goto('/me');
  await expect(page.getByRole('button', { name: /sign out|登出/i })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /visa support documents|簽證輔助文件/i }).click();

  await page.getByLabel(/legal name|護照英文姓名/i).fill('KAI HSU');
  await page.getByLabel(/nationality|國籍/i).selectOption('Taiwan');
  await page.getByLabel(/date of birth|出生日期/i).fill('1990-01-01');
  await page.getByLabel(/passport number|護照號碼/i).fill('A12345678');
  await page.getByLabel(/passport issuing country|護照核發國家/i).selectOption('Taiwan');
  await page.getByLabel(/passport expiry date|護照到期日/i).fill('2027-12-31');
  await page.getByLabel(/planned arrival date|預計入境日/i).fill('2026-05-01');
  await page.getByLabel(/planned departure date|預計離境日/i).fill('2026-05-31');
  await page.getByLabel(/address in taiwan|在台停留地址/i).fill('Taitung City, Taiwan');
  await page.getByLabel(/ROC mission|申請館處/i).fill('Taipei Economic and Cultural Office in Los Angeles');

  await page.getByRole('button', { name: /save details|儲存資料/i }).click();
  await expect(page.getByText(/details saved|資料已儲存/i)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /download visa support letter|下載簽證邀請函/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('tdf-visa-support-letter-TDF-VISA-2026-');
});
