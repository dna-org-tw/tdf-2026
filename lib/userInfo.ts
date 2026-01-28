/**
 * 获取用户浏览器信息
 * 包括时区、语言区域等
 */

/**
 * 获取用户时区
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
 * 获取用户语言区域（可能包含国家信息）
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
 * 获取所有用户信息
 */
export function getUserInfo() {
  return {
    timezone: getUserTimeZone(),
    locale: getUserLocale(),
  };
}
