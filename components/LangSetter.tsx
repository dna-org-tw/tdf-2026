'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * 客户端组件，用于根据 URL 参数动态设置 HTML lang 属性
 * 这有助于 SEO 和屏幕阅读器
 */
export default function LangSetter() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const langParam = searchParams.get('lang');
    const lang = langParam === 'en' ? 'en' : 'zh-TW';
    
    // 更新 HTML lang 属性
    document.documentElement.lang = lang;
    
    // 也可以更新 HTML dir 属性（如果需要 RTL 支持）
    // document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [searchParams]);

  return null;
}