/**
 * 依訪客來源地判斷要不要顯示同意牆（純函式，無 I/O）。
 *
 * 只有 GDPR／UK GDPR 管轄範圍才需要事前同意；其餘地區（本站主要受眾在台灣與東南亞）
 * 預設放行分析與廣告像素。2026-09-08 之前全球一律封鎖，導致廣告帶進的流量幾乎完全
 * 無法評估：733 次連結點擊只換到 1 次 landing_page_view。
 *
 * 每一屆的網站各自獨立，這份清單只屬於 2026，不與其他年份共用，也不需要同步。
 * 2027 有自己的一份，兩邊各自演進即可。
 */

/** EEA 27 國 + 冰島、列支敦斯登、挪威，加上英國與瑞士。 */
const CONSENT_REQUIRED = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'GB', 'CH',
]);

export type ConsentRegion = { country: string | null; consentRequired: boolean };

/** 判不出國別時一律要求同意（fail closed）。寧可少收資料，也不要在該問的地區沒問。 */
export function resolveConsentRegion(rawCountry: unknown): ConsentRegion {
  const country = typeof rawCountry === 'string' ? rawCountry.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(country)) return { country: null, consentRequired: true };
  return { country, consentRequired: CONSENT_REQUIRED.has(country) };
}
