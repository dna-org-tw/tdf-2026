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

interface NomadMapProps {
  items?: AccommodationItem[];
  coordinatesMap?: Map<string, unknown>;
  viewWebsite?: string;
  formatPhoneNumber?: (phone: string) => string;
  generateOpenStreetMapUrl?: (address: string) => string;
  formatAddressToString?: (address: string | StructuredAddress) => string;
}

export default function NomadMap(_props: NomadMapProps = {}) {
  // 台東市區座標 (22.7554, 121.1467)
  // 使用 ll 參數設定地圖中心點為台東市區，z=13 為適合的縮放級別
  const taitungCenter = { lat: 22.7554, lng: 121.1467 };
  const mapZoom = 13;
  const mapUrl = `https://www.google.com/maps/d/u/0/embed?mid=1jiU-gH4iF7e913fadDFio1Cg6OPjoEw&ehbc=2E312F&noprof=1&ll=${taitungCenter.lat}%2C${taitungCenter.lng}&z=${mapZoom}`;

  return (
    <div className="relative w-full h-full">
      <iframe
        src={mapUrl}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
