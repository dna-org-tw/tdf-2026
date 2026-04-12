'use client';

import { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useTranslation } from '@/hooks/useTranslation';
import { MapPin, ExternalLink, ChevronLeft, ChevronRight, ArrowRight, Navigation } from 'lucide-react';
import Image from 'next/image';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import { useLumaData } from '@/contexts/LumaDataContext';
import type { NomadFriendlyStore } from '@/components/NomadMap';

const NomadMap = dynamic(
  () => import('@/components/NomadMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-stone-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#10B8D9] mb-4"></div>
          <p className="text-sm text-slate-600">Loading map...</p>
        </div>
      </div>
    ),
  }
);

// Nomad-friendly store data provided by organizers
const NOMAD_STORES: NomadFriendlyStore[] = [
  { nameZh: "路得行旅 台東1館", addressZh: "950台東縣台東市廣東路162號", website: "https://taitung.nordenruder.com/", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=950台東縣台東市廣東路162號", latitude: 22.7543, longitude: 121.1528 },
  { nameZh: "路得行旅 台東2館", addressZh: "950台東縣台東市中山路374號", website: "https://www.taitung2.nordenruder.com/", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=950台東縣台東市中山路374號", latitude: 22.7512, longitude: 121.1485 },
  { nameZh: "東糖官邸民宿", addressZh: "台東縣台東市中興路二段200巷13號", website: "https://www.facebook.com/share/16CYARGnHe/?mibextid=wwXIfr", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東縣台東市中興路二段200巷13號", latitude: 22.7668, longitude: 121.1372 },
  { nameZh: "途中台東青年旅舍", addressZh: "950台東縣台東市安和路102巷30號", website: "https://www.onmywayhostel.com/hostels/taitung", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=950台東縣台東市安和路102巷30號", latitude: 22.7975, longitude: 121.1240 },
  { nameZh: "都蘭共好", addressZh: "台東縣東河鄉都蘭村125號", website: "https://www.facebook.com/share/14GHvzEj4K/", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東縣東河鄉都蘭村125號", latitude: 22.8476, longitude: 121.2213 },
  { nameZh: "金地亞哥民宿", addressZh: "台東縣東河鄉隆昌村七里橋20號", website: "mailto:strive178@gmail.com", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東縣東河鄉隆昌村七里橋20號", latitude: 22.8830, longitude: 121.1770 },
  { nameZh: "雲舍 Cloud Zen", addressZh: "955台東縣鹿野鄉永安村5鄰鹿寮路33巷106號", website: "https://site.traiwan.com/cloudzen.tw/index.html", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=955台東縣鹿野鄉永安村5鄰鹿寮路33巷106號", latitude: 22.9175, longitude: 121.1300 },
  { nameZh: "茶田關舍民宿", addressZh: "台東縣關山鎮平等路99號", website: "http://www.gsbnb.com.tw/", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東縣關山鎮平等路99號", latitude: 23.0488, longitude: 121.1627 },
  { nameZh: "茶田關舍貳館", addressZh: "台東縣關山鎮平等路90號", website: "https://teafarmland.hi-bnb.com/", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東縣關山鎮平等路90號", latitude: 23.0490, longitude: 121.1625 },
  { nameZh: "加走灣旅店民宿", addressZh: "962台東縣長濱鄉長濱村長濱286-1號", website: "https://www.longbeach.com.tw", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=962台東縣長濱鄉長濱村長濱286-1號", latitude: 23.3140, longitude: 121.3530 },
  { nameZh: "加走灣inn民宿", addressZh: "台東縣長濱鄉長濱村長濱286-2號", website: "https://www.facebook.com/share/14sKkYEG8c/", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東縣長濱鄉長濱村長濱286-2號", latitude: 23.3142, longitude: 121.3528 },
  { nameZh: "古栗house民宿", addressZh: "950台東市寧波街120號", website: "https://booking.owlting.com/4bf1a19a-dafc-43c6-8b02-94f8fc25d2ac", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=950台東市寧波街120號", latitude: 22.7562, longitude: 121.1385 },
  { nameZh: "ㄧ品苑民宿", addressZh: "台東市新興路一巷61弄20號", website: "https://www.facebook.com/share/1L8HSjurGu/?mibextid=wwXIfr", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東市新興路一巷61弄20號", latitude: 22.7932, longitude: 121.1238 },
  { nameZh: "美好東河民宿", addressZh: "959台東縣東河鄉南東河139號", website: "https://www.facebook.com/MH.Tungho?locale=zh_TW", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=959台東縣東河鄉南東河139號", latitude: 22.9667, longitude: 121.2900 },
  { nameZh: "奧麗雅安莊園", addressZh: "961台東縣成功鎮小馬路134-18號", website: "https://www.chateaudolea.com", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=961台東縣成功鎮小馬路134-18號", latitude: 23.0950, longitude: 121.3430 },
  { nameZh: "樂知旅店", addressZh: "台東市復興路145號", website: "https://www.yeshotel.com.tw", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東市復興路145號", latitude: 22.7534, longitude: 121.1505 },
  { nameZh: "風行館民宿", addressZh: "台東縣卑南鄉溫泉村溫泉路192號", website: "https://www.facebook.com/jnbnb.tt/", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東縣卑南鄉溫泉村溫泉路192號", latitude: 22.7250, longitude: 121.0700 },
  { nameZh: "旅蒔共享工作空間", addressZh: "台東縣池上鄉中東二路18號", website: "https://www.instagram.com/roots_coworking", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東縣池上鄉中東二路18號", latitude: 23.1160, longitude: 121.2200 },
  { nameZh: "仲夏綠茵民宿", addressZh: "950台東市志航路一段146巷25號", website: "https://www.facebook.com/share/15RkLfSDkX/", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=950台東市志航路一段146巷25號", latitude: 22.7803, longitude: 121.1284 },
  { nameZh: "月光祝福民宿", addressZh: "961台東縣成功鎮豐田路65號", website: "https://www.instagram.com/moonlight.blessing", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=961台東縣成功鎮豐田路65號", latitude: 23.1050, longitude: 121.3740 },
  { nameZh: "花東民宿", addressZh: "950台東市連航路77號", website: "https://loveandpeacebnb.com/%e8%8a%b1%e6%9d%b1%e6%b0%91%e5%ae%bf%e4%bb%8b%e7%b4%b9", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=950台東市連航路77號", latitude: 22.7706, longitude: 121.1216 },
  { nameZh: "宅民宿", addressZh: "950台東市中興路三段275巷10號", website: "https://loveandpeacebnb.com/%e5%ae%85%e6%b0%91%e5%ae%bf%e4%bb%8b%e7%b4%b9", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=950台東市中興路三段275巷10號", latitude: 22.7760, longitude: 121.1170 },
  { nameZh: "T-HOUSE民宿", addressZh: "台東市寶桑路50巷55弄18號", website: "https://booking.owlting.com/tt-house?lang=zh_TW&adult=1&child=0&infant=0", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東市寶桑路50巷55弄18號", latitude: 22.7530, longitude: 121.1573 },
  { nameZh: "tt-house民宿", addressZh: "台東市四維路488巷27弄3號", website: "https://booking.owlting.com/tt-house?lang=zh_TW&adult=1&child=0&infant=0", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東市四維路488巷27弄3號", latitude: 22.7580, longitude: 121.1577 },
  { nameZh: "月伴灣海景民宿", addressZh: "台東縣卑南鄉富山村11鄰富山130號", website: "http://yueban-bay.yoyotaitung.com.tw/", googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台東縣卑南鄉富山村11鄰富山130號", latitude: 22.7370, longitude: 121.1750 },
];

function StoreCard({ store }: { store: NomadFriendlyStore }) {
  return (
    <div className="flex-shrink-0 w-[260px] sm:w-[280px] rounded-xl border border-slate-200 bg-white p-4 hover:border-[#10B8D9]/50 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
          {store.nameZh}
        </h4>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed mb-3">
        {store.addressZh}
      </p>
      <div className="flex items-center gap-3">
        <a
          href={store.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[#10B8D9] hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          官網
        </a>
        <a
          href={store.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline"
        >
          <Navigation className="w-3 h-3" />
          Google Maps
        </a>
      </div>
    </div>
  );
}

function StoreCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const { lang } = useTranslation();
  const isEn = lang === 'en';

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
        {isEn ? 'Nomad-Friendly Venues' : '數位遊牧友善商家'}
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
        {NOMAD_STORES.map((store, i) => (
          <StoreCard key={i} store={store} />
        ))}
      </div>
    </div>
  );
}

export default function AccommodationSection() {
  const { t, lang } = useTranslation();
  const isEn = lang === 'en';
  const { events } = useLumaData();
  useSectionTracking({ sectionId: 'accommodation', sectionName: 'Accommodation Section', category: 'Event Information' });

  return (
    <section id="accommodation" className="bg-white pt-20 md:pt-28 lg:pt-32 transition-colors duration-500">
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
              <circle cx="12" cy="12" r="12" fill="rgb(249,168,37)" />
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
                stores={NOMAD_STORES}
                events={events}
                isEn={isEn}
              />
            </ErrorBoundary>
          </motion.div>
        </div>
      </div>

      {/* Store Carousel — full-width */}
      <div className="mb-12">
        <StoreCarousel />
      </div>

      {/* Partner Platforms — Obi-style full-width banner */}
      {t.accommodation.partnerPlatforms && t.accommodation.partnerPlatforms.items.length > 0 && (
        <div>
          {t.accommodation.partnerPlatforms.items.map((platform) => (
            <motion.a
              key={platform.name}
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="group block w-full overflow-hidden shadow-[0_4px_30px_rgba(0,104,183,0.25)] hover:shadow-[0_4px_40px_rgba(0,104,183,0.4)] transition-shadow duration-300"
            >
              <div className="relative bg-gradient-to-r from-[#004F8A] via-[#0068B7] to-[#0080DD] px-6 sm:px-12 lg:px-20 py-8 sm:py-10">
                <div className="absolute inset-0 opacity-[0.06] pointer-events-none overflow-hidden">
                  <svg className="absolute -top-10 -right-10 w-72 h-72" viewBox="0 0 200 200" fill="white">
                    <path d="M100 10L190 90V190H10V90L100 10Z" />
                  </svg>
                  <svg className="absolute -bottom-8 left-[20%] w-40 h-40" viewBox="0 0 200 200" fill="white">
                    <path d="M100 10L190 90V190H10V90L100 10Z" />
                  </svg>
                  <svg className="absolute top-2 left-[60%] w-28 h-28" viewBox="0 0 200 200" fill="white">
                    <path d="M100 10L190 90V190H10V90L100 10Z" />
                  </svg>
                </div>

                <div className="relative z-10 max-w-6xl mx-auto flex flex-col sm:flex-row items-center gap-6 sm:gap-12">
                  <div className="flex-shrink-0">
                    <div className="relative w-[200px] sm:w-[260px] h-[50px] sm:h-[64px]">
                      <Image
                        src={platform.logoWhite}
                        alt={platform.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                    {platform.tagline && (
                      <p className="text-white/60 text-xs sm:text-sm mt-2 text-center sm:text-left tracking-wider uppercase">
                        {platform.tagline}
                      </p>
                    )}
                  </div>

                  <div className="hidden sm:block w-px self-stretch bg-white/20 flex-shrink-0" />

                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-white text-sm sm:text-base lg:text-lg leading-relaxed mb-4">
                      {platform.description}
                    </p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                      {platform.features.map((feature) => (
                        <span
                          key={feature}
                          className="inline-block px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-sm"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex-shrink-0 hidden sm:flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 rounded-full px-6 py-3 transition-colors duration-300">
                    <span className="text-white text-sm font-bold whitespace-nowrap">
                      {platform.cta}
                    </span>
                    <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </div>

              <div className="sm:hidden bg-[#003D6B] px-6 py-3 flex items-center justify-center gap-2 group-hover:bg-[#002D50] transition-colors duration-300">
                <span className="text-white text-sm font-bold">
                  {platform.cta}
                </span>
                <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </motion.a>
          ))}
        </div>
      )}

    </section>
  );
}
