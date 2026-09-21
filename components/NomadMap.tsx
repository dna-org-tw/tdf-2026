"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CalendarEvent } from "@/lib/lumaSchedule";

export interface NomadFriendlyStore {
  nameZh: string;
  addressZh: string;
  website: string;
  googleMapsUrl: string;
  latitude: number;
  longitude: number;
}

interface NomadMapProps {
  stores: NomadFriendlyStore[];
  events?: CalendarEvent[];
  isEn?: boolean;
}

// Fix Leaflet default icon paths (broken by webpack). Icons live in /public.
function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/images/leaflet/marker-icon-2x.png",
    iconUrl: "/images/leaflet/marker-icon.png",
    shadowUrl: "/images/leaflet/marker-shadow.png",
  });
}

const MARKER_SHADOW = "/images/leaflet/marker-shadow.png";

const storeIcon = new L.Icon({
  iconUrl: "/images/leaflet/marker-icon-2x-grey.png",
  shadowUrl: MARKER_SHADOW,
  iconSize: [18, 30],
  iconAnchor: [9, 30],
  popupAnchor: [1, -24],
  shadowSize: [30, 30],
});

// Ticket type colors matching TicketsSection exactly
const TICKET_COLORS: Record<string, string> = {
  "#follower": "#A855F7",   // purple
  "#explorer": "#10B8D9",   // cyan
  "#contributor": "#00993E", // green
  "#backer": "#FFD028",      // gold
  "#other": "#D1D5DB",       // light gray (side events)
};
const DEFAULT_EVENT_COLOR = "#D1D5DB"; // light gray for side events

// Priority order: show the lowest accessible tier (most inclusive)
const TIER_PRIORITY = ["#follower", "#explorer", "#contributor", "#backer"];

function getEventColor(event: CalendarEvent): string {
  const tags = event.eligibility || [];
  for (const tier of TIER_PRIORITY) {
    if (tags.includes(tier)) {
      return TICKET_COLORS[tier];
    }
  }
  return DEFAULT_EVENT_COLOR;
}

const LEGEND_ITEMS = [
  { hex: "#A855F7", labelZh: "Follower 活動", labelEn: "Follower" },
  { hex: "#10B8D9", labelZh: "Explorer 活動", labelEn: "Explorer" },
  { hex: "#00993E", labelZh: "Contributor 活動", labelEn: "Contributor" },
  { hex: "#FFD028", labelZh: "Backer 活動", labelEn: "Backer" },
  { hex: "#D1D5DB", labelZh: "周邊活動", labelEn: "Side Event" },
];

const LEGEND_STORE_KEY = "store";

// Default center: Taitung
const TAITUNG_CENTER: [number, number] = [22.7583, 121.1444];
const DEFAULT_ZOOM = 12;

export default function NomadMap({ stores, events = [], isEn = false }: NomadMapProps) {
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  // All categories key set
  const allCategories = useMemo(() => {
    const all = new Set<string>(LEGEND_ITEMS.map((item) => item.hex));
    all.add(LEGEND_STORE_KEY);
    return all;
  }, []);

  // Interactive legend: click = show only that category; click again = show all
  const [visibleCategories, setVisibleCategories] = useState<Set<string>>(allCategories);

  const selectCategory = useCallback((key: string) => {
    setVisibleCategories((prev) => {
      // If only this category is visible, reset to all
      if (prev.size === 1 && prev.has(key)) {
        return allCategories;
      }
      // Otherwise show only this category
      return new Set([key]);
    });
  }, [allCategories]);

  const eventsWithCoords = useMemo(
    () => events.filter((e) => e.latitude != null && e.longitude != null),
    [events]
  );

  const showStores = visibleCategories.has(LEGEND_STORE_KEY);

  const visibleEvents = useMemo(
    () =>
      eventsWithCoords.filter((event) => {
        const color = getEventColor(event);
        return visibleCategories.has(color);
      }),
    [eventsWithCoords, visibleCategories]
  );

  // Build DivIcon for a given event
  const makeEventIcon = useCallback((event: CalendarEvent) => {
    const color = getEventColor(event);
    const escaped = (event.title || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const html = `<div class="event-marker">
      <div class="dot" style="background:${color}"></div>
      <div class="info">
        <span class="ev-title">${escaped}</span>
        ${event.startDate ? `<span class="ev-date">${event.startDate}</span>` : ""}
      </div>
    </div>`;
    return new L.DivIcon({
      html,
      className: "",
      iconSize: [0, 0],
      iconAnchor: [6, 6],
    });
  }, []);

  return (
    <>
      <style>{`
        .event-marker {
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          cursor: pointer;
        }
        .event-marker .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          flex-shrink: 0;
        }
        .event-marker .info {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }
        .event-marker .ev-title {
          font-size: 11px;
          font-weight: 600;
          color: #1e293b;
          text-shadow: 0 0 2px #fff, 0 0 2px #fff, 1px 1px 0 #fff, -1px -1px 0 #fff;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .event-marker .ev-date {
          font-size: 9px;
          color: #64748b;
          text-shadow: 0 0 2px #fff, 0 0 2px #fff;
        }
      `}</style>
      <div className="relative w-full h-[400px] sm:h-[500px] md:h-[600px]">
        <MapContainer
          center={TAITUNG_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Nomad-friendly stores (subdued gray pin markers) */}
          {showStores &&
            stores.map((store, i) => (
              <Marker
                key={`store-${i}`}
                position={[store.latitude, store.longitude]}
                icon={storeIcon}
                opacity={0.6}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <strong className="text-sm">{store.nameZh}</strong>
                    <p className="text-xs text-slate-600 mt-1">{store.addressZh}</p>
                    <div className="flex gap-2 mt-2">
                      {store.website && (
                        <a
                          href={store.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {isEn ? "Website" : "官方網站"}
                        </a>
                      )}
                      <a
                        href={store.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 hover:underline"
                      >
                        Google Maps
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* Luma events (DivIcon markers with title + date label) */}
          {visibleEvents.map((event, i) => {
            const icon = makeEventIcon(event);
            return (
              <Marker
                key={`event-${event.title}-${event.startDate}-${i}`}
                position={[event.latitude!, event.longitude!]}
                icon={icon}
              >
                <Popup>
                  <div className="min-w-[220px]">
                    <strong className="text-sm">{event.title}</strong>
                    {event.eligibility && event.eligibility.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {event.eligibility.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600"
                          >
                            {tag.replace("#", "")}
                          </span>
                        ))}
                      </div>
                    )}
                    {event.location && (
                      <p className="text-xs text-slate-600 mt-1">{event.location}</p>
                    )}
                    {event.startDate && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {event.startDate}
                        {event.startTime && ` ${new Date(event.startTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' })}`}
                      </p>
                    )}
                    {event.url && (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                      >
                        {isEn ? "View on Luma" : "在 Luma 查看"}
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Interactive Legend */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2.5 shadow-md text-xs space-y-1.5 max-w-[85%] select-none">
          {/* Stores */}
          <button
            type="button"
            className="flex items-center gap-1.5 w-full text-left"
            onClick={() => selectCategory(LEGEND_STORE_KEY)}
          >
            <svg width="14" height="20" viewBox="0 0 14 20" className="shrink-0" style={{ opacity: showStores ? 1 : 0.3 }}>
              <path d="M7 0C3.13 0 0 3.13 0 7c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#9CA3AF" stroke="#fff" strokeWidth="1"/>
              <circle cx="7" cy="7" r="2.5" fill="#fff"/>
            </svg>
            <span className={`font-medium transition-opacity ${showStores ? "opacity-100" : "opacity-40 line-through"}`}>
              {isEn ? "Nomad-Friendly Stores" : "遊牧友善商家"}
            </span>
          </button>
          {/* Divider */}
          <div className="border-t border-slate-200" />
          {/* Events by ticket type */}
          <div className="text-[10px] text-slate-500 font-medium">{isEn ? "Events by ticket type" : "活動（依票種分類）"}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {LEGEND_ITEMS.map(({ hex, labelZh, labelEn }) => {
              const active = visibleCategories.has(hex);
              return (
                <button
                  key={hex}
                  type="button"
                  className="flex items-center gap-1 cursor-pointer"
                  onClick={() => selectCategory(hex)}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0" style={{ opacity: active ? 1 : 0.3 }}>
                    <circle cx="6" cy="6" r="5" fill={hex} stroke="#fff" strokeWidth="1.5"/>
                  </svg>
                  <span className={`transition-opacity ${active ? "opacity-100" : "opacity-40 line-through"}`}>
                    {isEn ? labelEn : labelZh}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
