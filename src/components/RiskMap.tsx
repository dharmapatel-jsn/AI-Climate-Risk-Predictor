"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, Circle, TileLayer, Popup } from "react-leaflet";
import type { ZoneRisk } from "@/types/climate";

interface RiskMapProps {
  zones: ZoneRisk[];
  center: [number, number];
  zoom?: number;
}

const colorFromScore = (score: number): string => {
  if (score >= 0.85) return "#9f1239";
  if (score >= 0.65) return "#dc2626";
  if (score >= 0.4) return "#f59e0b";
  return "#10b981";
};

export default function RiskMap({ zones, center, zoom = 4 }: RiskMapProps) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-[420px] w-full rounded-2xl border border-white/15">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {zones.map((zone) => (
        <Circle
          key={zone.id}
          center={[zone.lat, zone.lon]}
          radius={zone.radiusKm * 1000}
          pathOptions={{
            color: colorFromScore(zone.overallScore),
            fillColor: colorFromScore(zone.overallScore),
            fillOpacity: 0.25,
            weight: 2,
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{zone.name}</p>
              <p>Risk: {(zone.overallScore * 100).toFixed(0)}%</p>
              <p>Flood: {(zone.risks.flood * 100).toFixed(0)}%</p>
              <p>Heat: {(zone.risks.heatwave * 100).toFixed(0)}%</p>
              <p>Air: {(zone.risks.airQuality * 100).toFixed(0)}%</p>
            </div>
          </Popup>
        </Circle>
      ))}
    </MapContainer>
  );
}
