/**
 * 獲取使用者瀏覽器資訊
 * 包括時區、語言區域等
 */

/**
 * 獲取使用者時區
 */
export function getUserTimeZone(): string {
  if (typeof window === 'undefined') {
    return 'UTC';
  }
  
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Failed to get timezone:', error);
    return 'UTC';
  }
}

/**
 * 獲取使用者語言區域（可能包含國家資訊）
 */
export function getUserLocale(): string {
  if (typeof window === 'undefined') {
    return 'en-US';
  }
  
  try {
    return navigator.language || navigator.languages?.[0] || 'en-US';
  } catch (error) {
    console.warn('Failed to get locale:', error);
    return 'en-US';
  }
}

/**
 * 獲取所有使用者資訊
 */
export function getUserInfo() {
  return {
    timezone: getUserTimeZone(),
    locale: getUserLocale(),
  };
}
