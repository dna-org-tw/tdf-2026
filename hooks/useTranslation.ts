'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { content, Language, Content } from '@/data/content';

// 偵測瀏覽器語系並回傳對應的語言代碼（僅在客戶端使用）
function getBrowserLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'zh'; // 服務端渲染時使用預設值
  }
  
  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'en';
  
  // 檢查是否為中文語系（包含 zh, zh-TW, zh-CN, zh-HK 等）
  if (browserLang.toLowerCase().startsWith('zh')) {
    return 'zh';
  }
  
  // 其他語系預設為英文
  return 'en';
}

// 從 URL 參數取得語言，若沒有則回傳預設值（伺服端和客戶端皆可用）
function getInitialLanguage(searchParams: URLSearchParams | null): Language {
  if (!searchParams) {
    return 'zh'; // 如果 searchParams 不可用，使用預設值
  }
  
  const langParam = searchParams.get('lang');
  if (langParam === 'en' || langParam === 'zh') {
    return langParam as Language; // 類型斷言：已經確認是有效的語言代碼
  }
  
  return 'zh'; // 預設為中文，確保服務端和客戶端一致
}

export function useTranslation() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // 初始值從 URL 參數獲取，確保服務端和客戶端一致
  const [lang, setLang] = useState<Language>(() => {
    try {
      return getInitialLanguage(searchParams);
    } catch (error) {
      return 'zh'; // 如果出錯，使用預設值
    }
  });
  const [mounted, setMounted] = useState(false);

  // 標記組件已掛載（hydration 完成）
  useEffect(() => {
    // 使用 setTimeout 來避免在 effect 中直接調用 setState
    setTimeout(() => {
      setMounted(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (!mounted) return; // 等待 hydration 完成
    
    try {
      const langParam = searchParams?.get('lang');
      if (langParam === 'en' || langParam === 'zh') {
        // 使用 setTimeout 來避免在 effect 中直接調用 setState
        setTimeout(() => {
          setLang(langParam as Language); // 類型斷言：已經確認是有效的語言代碼
        }, 0);
      } else {
        // 如果 URL 參數中沒有指定語系，使用瀏覽器語系（僅在客戶端）
        setTimeout(() => {
          setLang(getBrowserLanguage());
        }, 0);
      }
    } catch (error) {
      // 如果出錯，保持當前語言或使用預設值
      console.error('Error updating language:', error);
    }
  }, [searchParams, mounted]);

  const toggleLanguage = () => {
    const newLang = lang === 'zh' ? 'en' : 'zh';
    try {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('lang', newLang);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } catch (error) {
      console.error('Error toggling language:', error);
    }
  };

  const setLanguage = (newLang: Language) => {
    try {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('lang', newLang);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } catch (error) {
      console.error('Error setting language:', error);
    }
  }

  // 確保 lang 是有效的語言代碼，並確保 content[lang] 存在
  const safeLang: Language = (lang === 'en' || lang === 'zh') ? lang : 'zh';
  const safeContent: Content = content[safeLang] || content.zh; // 如果找不到對應的翻譯，使用中文作為後備

  return {
    lang: safeLang,
    t: safeContent,
    toggleLanguage,
    setLanguage
  };
}
