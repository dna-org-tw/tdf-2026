'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useTranslation } from '@/hooks/useTranslation';
import { MapPin, ExternalLink, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import type { StructuredAddress } from '@/components/NomadMap';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import type { TaitungAccommodation } from '@/lib/parseNomadStores';

interface Coordinates {
  lat: number;
  lon: number;
}

// 動態導入地圖組件（避免 SSR 問題）
// 新增 loading 狀態與延遲載入優化
const NomadMap = dynamic(
  () => import('@/components/NomadMap'),
  { 
    ssr: false,
    loading: () => {
      // This will be replaced by the actual translation in the component
      return (
        <div className="flex items-center justify-center h-full bg-stone-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#10B8D9] mb-4"></div>
            <p className="text-sm text-slate-600">Loading map...</p>
          </div>
        </div>
      );
    },
  }
);

// 將地址物件或字串轉換為字串格式
function formatAddressToString(address: string | StructuredAddress): string {
  if (typeof address === 'string') {
    return address;
  }
  
  // 建構完整地址字串
  const parts: string[] = [];
  
  if (address['addr:postcode']) {
    parts.push(address['addr:postcode']);
  }
  
  if (address['addr:city']) {
    parts.push(address['addr:city']);
  }
  
  if (address['addr:district']) {
    parts.push(address['addr:district']);
  }
  
  if (address['addr:street']) {
    parts.push(address['addr:street']);
  }
  
  if (address['addr:housenumber']) {
    parts.push(address['addr:housenumber']);
  }
  
  return parts.join('');
}

function StoreCard({ store, isEn }: { store: TaitungAccommodation; isEn: boolean }) {
  return (
    <a
      href={store.website}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 w-[260px] sm:w-[280px] group rounded-xl border border-slate-200 bg-white p-4 hover:border-[#10B8D9]/50 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 group-hover:text-[#10B8D9] transition-colors">
          {isEn ? store.nameEn : store.nameZh}
        </h4>
        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-[#10B8D9] mt-0.5 transition-colors" />
      </div>
      <p className="text-xs text-slate-500 leading-relaxed mb-2">
        {isEn ? store.addressEn : store.addressZh}
      </p>
      {store.description && (
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-5">
          {store.description}
        </p>
      )}
    </a>
  );
}

function AccommodationCarousel({ stores }: { stores: TaitungAccommodation[] }) {
  const { lang } = useTranslation();
  const isEn = lang === 'en';
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < maxScroll - 4);
  }, []);

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const step = 296 * 2;
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
  }, []);

  return (
    <div>
      <h3 className="text-xl sm:text-2xl font-display font-bold text-[#1E1F1C] text-center mb-4 flex items-center justify-center gap-2">
        <MapPin className="w-5 h-5 text-[#10B8D9]" />
        {isEn ? 'Recommended Accommodations' : '推薦住宿'}
      </h3>
      <div className="flex items-center justify-end mb-3 px-4 sm:px-6">
        <div className="flex gap-1.5">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="p-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="p-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 px-4 sm:px-6 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {stores.map((store, i) => (
          <StoreCard key={i} store={store} isEn={isEn} />
        ))}
      </div>
    </div>
  );
}

export default function AccommodationSection({ taitungStores }: { taitungStores: TaitungAccommodation[] }) {
  const { t } = useTranslation();
  const items = t.accommodation.items;
  useSectionTracking({ sectionId: 'accommodation', sectionName: 'Accommodation Section', category: 'Event Information' });
  
  // 直接從資料中獲取經緯度，而不是透過 geocoding API
  const coordinatesMap = useMemo(() => {
    const coords = new Map<string, Coordinates>();
    items.forEach((item) => {
      // 檢查資料中是否有經緯度欄位
      if ('latitude' in item && 'longitude' in item && 
          typeof item.latitude === 'number' && typeof item.longitude === 'number') {
        const addressString = formatAddressToString(item.address);
        coords.set(addressString, {
          lat: item.latitude,
          lon: item.longitude,
        });
      }
    });
    return coords;
  }, [items]);

  const generateOpenStreetMapUrl = (address: string) => {
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
  };

  // 正規化手機號碼格式
  const formatPhoneNumber = (phone: string): string => {
    // 移除所有空格和特殊字符
    const cleaned = phone.replace(/\s/g, '');
    
    // 如果是台灣國際碼開頭 (886)
    if (cleaned.startsWith('886')) {
      const localNumber = cleaned.substring(3);
      // 如果是手機號碼 (09開頭，10位數)
      if (localNumber.startsWith('09') && localNumber.length === 10) {
        return `+886 ${localNumber.substring(1, 2)} ${localNumber.substring(2, 6)} ${localNumber.substring(6)}`;
      }
      // 如果是9開頭的9位數號碼
      if (localNumber.startsWith('9') && localNumber.length === 9) {
        return `+886 ${localNumber.substring(0, 1)} ${localNumber.substring(1, 5)} ${localNumber.substring(5)}`;
      }
      // 其他格式保持原樣
      return `+886 ${localNumber}`;
    }
    
    // 如果是09開頭的台灣手機號碼 (10位數)
    if (cleaned.startsWith('09') && cleaned.length === 10) {
      return `0${cleaned.substring(1, 2)} ${cleaned.substring(2, 6)} ${cleaned.substring(6)}`;
    }
    
    // 如果是9開頭的9位數號碼（補0變成10位數）
    if (cleaned.startsWith('9') && cleaned.length === 9) {
      return `0${cleaned.substring(0, 1)} ${cleaned.substring(1, 5)} ${cleaned.substring(5)}`;
    }
    
    // 其他格式保持原樣
    return phone;
  };


  return (
    <section id="accommodation" className="bg-white py-20 md:py-28 lg:py-32 transition-colors duration-500">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 text-center"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-[#1E1F1C] mb-6">
            {t.accommodation.title}
          </h2>
          <p className="text-lg md:text-xl text-[#1E1F1C]/80 max-w-3xl mx-auto leading-relaxed mb-6">
            {t.accommodation.subtitle}
          </p>
          <div className="flex items-center justify-center gap-2 mb-8">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="12"
                cy="12"
                r="12"
                fill="rgb(249,168,37)"
              />
              <path
                d="M12 2L15.09 8.26L22 9.5L16.55 14.47L17.64 21.51L12 18.27L6.36 21.51L7.45 14.47L2 9.5L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
            <span className="text-sm font-medium" style={{ color: 'rgb(249,168,37)' }}>
              {t.accommodation.badge}
            </span>
          </div>
        </motion.div>

        {/* Map Container */}
        <div className="max-w-5xl mx-auto mb-12">
          {coordinatesMap.size > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-lg overflow-hidden shadow-lg border border-[#F6F6F6]"
              style={{ width: '100%' }}
            >
              <ErrorBoundary
                fallback={
                  <div className="flex flex-col items-center justify-center h-full bg-stone-50 p-8">
                    <MapPin className="w-16 h-16 text-amber-500 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {t.accommodation.mapErrorTitle}
                    </h3>
                    <p className="text-sm text-slate-600 mb-4 text-center max-w-md">
                      {t.accommodation.mapErrorDescription}{' '}
                      <a
                        href="https://www.google.com/maps/search/?api=1&query=台東+花蓮+住宿"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#10B8D9] hover:underline"
                      >
                        {t.accommodation.mapErrorSearchLink}
                      </a>
                      {' '}{t.accommodation.mapErrorSearchSuffix}
                    </p>
                  </div>
                }
              >
                <NomadMap
                  items={items}
                  coordinatesMap={coordinatesMap}
                  viewWebsite={t.accommodation.viewWebsite}
                  formatPhoneNumber={formatPhoneNumber}
                  generateOpenStreetMapUrl={generateOpenStreetMapUrl}
                  formatAddressToString={formatAddressToString}
                />
              </ErrorBoundary>
            </motion.div>
          ) : (
            <div className="text-center py-24">
              <p className="text-[#1E1F1C]/80">{t.accommodation.mapLoadError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Accommodation Carousel — full-width */}
      {taitungStores.length > 0 && (
        <div className="mb-12">
          <AccommodationCarousel stores={taitungStores} />
        </div>
      )}

      {/* Partner Platforms */}
      {t.accommodation.partnerPlatforms && t.accommodation.partnerPlatforms.items.length > 0 && (
        <div className="container mx-auto px-4 sm:px-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto"
          >
            <h3 className="text-xl sm:text-2xl font-display font-bold text-[#1E1F1C] text-center mb-2">
              {t.accommodation.partnerPlatforms.title}
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              {t.accommodation.partnerPlatforms.subtitle}
            </p>
            <div className="flex flex-col gap-4">
              {t.accommodation.partnerPlatforms.items.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 hover:border-[#10B8D9]/50 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex-shrink-0 w-[160px] h-[48px] relative">
                    <Image
                      src={platform.logo}
                      alt={platform.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h4 className="text-base font-semibold text-slate-900 group-hover:text-[#10B8D9] transition-colors mb-1.5">
                      {platform.name}
                    </h4>
                    <p className="text-sm text-slate-500 leading-relaxed mb-3">
                      {platform.description}
                    </p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                      {platform.features.map((feature) => (
                        <span
                          key={feature}
                          className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full bg-[#10B8D9]/10 text-[#10B8D9]"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-[#10B8D9] group-hover:translate-x-1 transition-all flex-shrink-0 hidden sm:block" />
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* CTA Buttons */}
      {t.accommodation.ctas && t.accommodation.ctas.length > 0 && (
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center flex flex-wrap justify-center gap-4"
          >
            {t.accommodation.ctas.map((cta) => {
              const isPrimary = cta.type === "Register";
              return (
                <motion.a
                  key={cta.type}
                  href={cta.href}
                  target={cta.href.startsWith('http') ? '_blank' : undefined}
                  rel={cta.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`inline-block px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 rounded-full text-sm sm:text-base md:text-lg font-bold tracking-wide transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 ${
                    isPrimary
                      ? 'bg-[#10B8D9] hover:bg-[#10B8D9]/90 text-white shadow-[#10B8D9]/30 hover:shadow-[#10B8D9]/50'
                      : 'bg-white hover:bg-stone-50 text-[#1E1F1C] border-2 border-[#1E1F1C] hover:border-[#10B8D9]'
                  }`}
                >
                  {cta.text}
                </motion.a>
              );
            })}
          </motion.div>
        </div>
      )}
    </section>
  );
}
