'use client';

import { useCallback } from 'react';

const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

/**
 * Hook to execute reCAPTCHA Enterprise verification
 * @param action - The action name for reCAPTCHA (default: 'subscribe')
 * @returns A function that executes reCAPTCHA and returns the token
 */
export function useRecaptcha(action: string = 'subscribe') {
  const executeRecaptcha = useCallback(async (): Promise<string | null> => {
    if (!recaptchaSiteKey) {
      // 如果没有配置 reCAPTCHA，返回 null（允许继续提交）
      return null;
    }

    try {
      // 检查 grecaptcha 是否已加载
      if (typeof window === 'undefined' || !window.grecaptcha?.enterprise) {
        throw new Error('reCAPTCHA is not loaded. Please refresh the page.');
      }

      // 执行 reCAPTCHA 验证
      const token = await window.grecaptcha.enterprise.execute(recaptchaSiteKey, {
        action,
      });

      return token;
    } catch (error) {
      console.error('reCAPTCHA execution failed:', error);
      throw error;
    }
  }, [action]);

  return { executeRecaptcha };
}
