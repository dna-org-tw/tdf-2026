'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useTranslation } from '@/hooks/useTranslation';
import { Award } from 'lucide-react';
import type { Coordinates } from '@/utils/geocoding';
import type { StructuredAddress } from '@/components/AccommodationMap';

// 动态导入地图组件（避免 SSR 问题）
const AccommodationMap = dynamic(
  () => import('@/components/AccommodationMap'),
  { ssr: false }
);

// 将地址对象或字符串转换为字符串格式
function formatAddressToString(address: string | StructuredAddress): string {
  if (typeof address === 'string') {
    return address;
  }
  
  // 构建完整地址字符串
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

export default function AccommodationSection() {
  const { t } = useTranslation();
  const items = t.accommodation.items;
  const [coordinatesMap, setCoordinatesMap] = useState<Map<string, Coordinates>>(new Map());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // 直接从数据中获取经纬度，而不是通过 geocoding API
    const coords = new Map<string, Coordinates>();
    items.forEach((item) => {
      // 检查数据中是否有经纬度字段
      if ('latitude' in item && 'longitude' in item && 
          typeof item.latitude === 'number' && typeof item.longitude === 'number') {
        const addressString = formatAddressToString(item.address);
        coords.set(addressString, {
          lat: item.latitude,
          lon: item.longitude,
        });
      }
    });
    setCoordinatesMap(coords);
  }, [items, mounted]);

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
    <section id="accommodation" className="bg-white py-24 md:py-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold text-[#1E1F1C] mb-6">
            {t.accommodation.title}
          </h2>
          <p className="text-lg md:text-xl text-[#1E1F1C]/80 max-w-3xl mx-auto leading-relaxed">
            {t.accommodation.subtitle}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Award className="w-5 h-5 text-[#00993E]" />
            <span className="text-sm font-medium text-[#00993E]">
              {t.accommodation.badge}
            </span>
          </div>
        </motion.div>

        {/* Map Container */}
        <div className="max-w-5xl mx-auto mb-12">
          {mounted && coordinatesMap.size > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-lg overflow-hidden shadow-lg border border-[#F6F6F6]"
              style={{ height: '600px', width: '100%' }}
            >
              <AccommodationMap
                items={items}
                coordinatesMap={coordinatesMap}
                viewWebsite={t.accommodation.viewWebsite}
                formatPhoneNumber={formatPhoneNumber}
                generateOpenStreetMapUrl={generateOpenStreetMapUrl}
                formatAddressToString={formatAddressToString}
              />
            </motion.div>
          ) : (
            <div className="text-center py-24">
              <p className="text-[#1E1F1C]/80">{t.accommodation.mapLoadError}</p>
            </div>
          )}
        </div>

        {/* CTA Buttons */}
        {t.accommodation.ctas && t.accommodation.ctas.length > 0 && (
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
                  className={`inline-block px-10 py-4 rounded-full text-lg font-bold tracking-wide transition-all shadow-lg ${
                    isPrimary
                      ? 'bg-[#10B8D9] hover:bg-[#10B8D9]/80 text-white shadow-[#004E9D]/20'
                      : 'bg-white hover:bg-stone-50 text-[#1E1F1C] border-2 border-[#1E1F1C]'
                  }`}
                >
                  {cta.text}
                </motion.a>
              );
            })}
          </motion.div>
        )}
      </div>
    </section>
  );
}
