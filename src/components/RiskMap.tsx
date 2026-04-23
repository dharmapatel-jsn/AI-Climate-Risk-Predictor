"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { DivIcon } from "leaflet";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import { getCountryName } from "@/lib/countries";
import type { ZoneRisk } from "@/types/climate";

interface RiskMapProps {
  zones: ZoneRisk[];
  center: [number, number];
  zoom?: number;
  autoFitBounds?: boolean;
}

const colorFromScore = (score: number): string => {
  if (score >= 0.85) return "#9f1239";
  if (score >= 0.65) return "#dc2626";
  if (score >= 0.4) return "#f59e0b";
  return "#10b981";
};

const createTagIcon = (label: string, score: number): DivIcon => {
  const scoreTint = colorFromScore(score);

  return new DivIcon({
    className: "",
    html: `
      <div style="
        min-width: 72px;
        padding: 6px 10px;
        border-radius: 9999px;
        border: 1px solid rgba(255,255,255,0.7);
        background: ${scoreTint};
        color: #ecfdf5;
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0.08em;
        text-align: center;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.35), 0 0 0 6px rgba(16, 185, 129, 0.16);
        white-space: nowrap;
      ">${label}</div>
    `,
    iconSize: [72, 28],
    iconAnchor: [36, 14],
    popupAnchor: [0, -12],
  });
};

function BoundsController({ zones, autoFitBounds }: Pick<RiskMapProps, "zones" | "autoFitBounds">) {
  const map = useMap();

  useEffect(() => {
    if (!autoFitBounds || zones.length === 0) return;

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;

      const bounds = zones.map((zone) => [zone.lat, zone.lon] as [number, number]);
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 2 });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [autoFitBounds, map, zones]);

  return null;
}

export default function RiskMap({ zones, center, zoom = 4, autoFitBounds = true }: RiskMapProps) {
  const countryZones = useMemo(() => {
    const grouped = new Map<string, ZoneRisk>();

    for (const zone of zones) {
      const current = grouped.get(zone.countryCode);
      if (!current || zone.overallScore > current.overallScore) {
        grouped.set(zone.countryCode, zone);
      }
    }

    return Array.from(grouped.values());
  }, [zones]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.14),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.12),transparent_26%),radial-gradient(circle_at_50%_80%,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.95),rgba(15,23,42,0.92))]">
      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
        Green tag = strongest country marker
      </div>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="absolute inset-0 h-full w-full">
        <BoundsController zones={countryZones} autoFitBounds={autoFitBounds} />
        {countryZones.map((zone) => (
          <Marker
            key={zone.countryCode}
            position={[zone.lat, zone.lon]}
            icon={createTagIcon(getCountryName(zone.countryCode), zone.overallScore)}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{getCountryName(zone.countryCode)}</p>
                <p>{zone.name}</p>
                <p>Country code: {zone.countryCode}</p>
                <p>Risk: {(zone.overallScore * 100).toFixed(0)}%</p>
                <p>Flood: {(zone.risks.flood * 100).toFixed(0)}%</p>
                <p>Heat: {(zone.risks.heatwave * 100).toFixed(0)}%</p>
                <p>Air: {(zone.risks.airQuality * 100).toFixed(0)}%</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
