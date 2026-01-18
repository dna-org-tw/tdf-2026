'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Coordinates } from '@/utils/geocoding';

// 修复 Leaflet 默认 icon 在 Next.js 中的问题
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface StructuredAddress {
  "addr:city": string;
  "addr:district": string;
  "addr:street": string;
  "addr:housenumber": string;
  "addr:postcode": string;
}

export interface AccommodationItem {
  name: string;
  address: string | StructuredAddress;
  latitude?: number;
  longitude?: number;
  website?: string;
  description: string;
  phone?: string;
}

interface AccommodationMapProps {
  items: AccommodationItem[];
  coordinatesMap: Map<string, Coordinates>;
  viewWebsite: string;
  formatPhoneNumber: (phone: string) => string;
  generateOpenStreetMapUrl: (address: string) => string;
  formatAddressToString: (address: string | StructuredAddress) => string;
}

// 自定义 icon
const createCustomIcon = () => {
  return L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
  });
};

// 自动调整地图边界以显示所有 marker
function MapBoundsController({ 
  coordinatesMap 
}: { 
  coordinatesMap: Map<string, Coordinates> 
}) {
  const map = useMap();

  useEffect(() => {
    if (coordinatesMap.size > 0) {
      const bounds = L.latLngBounds(
        Array.from(coordinatesMap.values()).map(coord => [coord.lat, coord.lon] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, coordinatesMap]);

  return null;
}

export default function AccommodationMap({
  items,
  coordinatesMap,
  viewWebsite,
  formatPhoneNumber,
  generateOpenStreetMapUrl,
  formatAddressToString,
}: AccommodationMapProps) {
  // 计算地图中心点（所有住宿点的平均值）
  const getMapCenter = (): [number, number] => {
    if (coordinatesMap.size === 0) {
      // 默认台東市中心坐标
      return [22.7554, 121.1467];
    }

    const coordsArray = Array.from(coordinatesMap.values());
    const avgLat = coordsArray.reduce((sum, coord) => sum + coord.lat, 0) / coordsArray.length;
    const avgLon = coordsArray.reduce((sum, coord) => sum + coord.lon, 0) / coordsArray.length;

    return [avgLat, avgLon];
  };

  const customIcon = createCustomIcon();

  return (
    <MapContainer
      center={getMapCenter()}
      zoom={11}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
      className="z-0"
    >
      <MapBoundsController coordinatesMap={coordinatesMap} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {items.map((item) => {
        const addressString = formatAddressToString(item.address);
        const coords = coordinatesMap.get(addressString);
        if (!coords) return null;

        return (
          <Marker key={item.name} position={[coords.lat, coords.lon]} icon={customIcon}>
            <Popup className="custom-popup" maxWidth={350}>
              <div className="min-w-[280px] max-w-[320px] p-2">
                {/* Title */}
                <h3 className="text-lg font-bold text-[#1E1F1C] mb-2">
                  {item.name}
                </h3>

                {/* Description */}
                <p className="text-sm text-[#1E1F1C]/80 mb-3 leading-relaxed">
                  {item.description}
                </p>

                <div className="space-y-2 pt-2 border-t border-[#F6F6F6]">
                  {/* Address */}
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 text-[#10B8D9] mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <a
                      href={generateOpenStreetMapUrl(addressString)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#1E1F1C] hover:text-[#10B8D9] transition-colors flex items-center gap-1"
                    >
                      <span>{addressString}</span>
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  </div>

                  {/* Phone */}
                  {item.phone && (
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-[#10B8D9] flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      <a
                        href={`tel:${item.phone.replace(/\s/g, '')}`}
                        className="text-sm text-[#1E1F1C] hover:text-[#10B8D9] transition-colors"
                      >
                        {formatPhoneNumber(item.phone)}
                      </a>
                    </div>
                  )}

                  {/* Website */}
                  {item.website && (
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-[#10B8D9] flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      <a
                        href={item.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#10B8D9] hover:text-[#004E9D] transition-colors flex items-center gap-1"
                      >
                        {viewWebsite}
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
