"use client";

import { useState } from "react";

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
  const [mapActive, setMapActive] = useState(false);
  const taitungCenter = { lat: 22.7554, lng: 121.1467 };
  const mapZoom = 13;
  const mapUrl = `https://www.google.com/maps/d/u/0/embed?mid=1jiU-gH4iF7e913fadDFio1Cg6OPjoEw&ehbc=2E312F&noprof=1&ll=${taitungCenter.lat}%2C${taitungCenter.lng}&z=${mapZoom}`;

  return (
    <div
      className="relative w-full h-[400px] sm:h-[500px] md:h-[600px]"
      onMouseLeave={() => setMapActive(false)}
    >
      <iframe
        src={mapUrl}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      {!mapActive && (
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={() => setMapActive(true)}
        />
      )}
    </div>
  );
}
