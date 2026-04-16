'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { content, Language, Content } from '@/data/content';

// Detect browser language and return the corresponding language code (client-side only)
function getBrowserLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'zh'; // Default value for server-side rendering
  }
  
  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'en';
  
  // Check if it is a Chinese locale (including zh, zh-TW, zh-CN, zh-HK, etc.)
  if (browserLang.toLowerCase().startsWith('zh')) {
    return 'zh';
  }
  
  // Default to English for all other locales
  return 'en';
}

// Get language from URL params, or return default (works on both server and client)
function getInitialLanguage(searchParams: URLSearchParams | null): Language {
  if (!searchParams) {
    return 'zh'; // Use default if searchParams is unavailable
  }
  
  const langParam = searchParams.get('lang');
  if (langParam === 'en' || langParam === 'zh') {
    return langParam as Language; // Type assertion: already validated as a valid language code
  }
  
  return 'zh'; // Default to Chinese to ensure server-client consistency
}

export function useTranslation() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Initial value from URL params to ensure server-client consistency
  const [lang, setLang] = useState<Language>(() => {
    try {
      return getInitialLanguage(searchParams);
    } catch (error) {
      return 'zh'; // Use default on error
    }
  });
  const [mounted, setMounted] = useState(false);

  // Mark component as mounted (hydration complete)
  useEffect(() => {
    // Use setTimeout to avoid calling setState directly inside an effect
    setTimeout(() => {
      setMounted(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (!mounted) return; // Wait for hydration to complete
    
    try {
      const langParam = searchParams?.get('lang');
      if (langParam === 'en' || langParam === 'zh') {
        // Use setTimeout to avoid calling setState directly inside an effect
        setTimeout(() => {
          setLang(langParam as Language); // Type assertion: already validated as a valid language code
        }, 0);
      } else {
        // If no language specified in URL params, use browser language (client-side only)
        setTimeout(() => {
          setLang(getBrowserLanguage());
        }, 0);
      }
    } catch (error) {
      // On error, keep the current language or use default
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

  // Ensure lang is a valid language code and content[lang] exists
  const safeLang: Language = (lang === 'en' || lang === 'zh') ? lang : 'zh';
  const safeContent: Content = content[safeLang] || content.zh; // Fall back to Chinese if translation not found

  return {
    lang: safeLang,
    t: safeContent,
    toggleLanguage,
    setLanguage
  };
}
