import { NextRequest, NextResponse } from "next/server";
import { appendAlerts } from "@/lib/alerts-store";
import {
  computeRiskBreakdown,
  overallScoreFromBreakdown,
  rationaleFromBreakdown,
  riskLevelFromScore,
} from "@/lib/risk-utils";
import { getWeatherSnapshot } from "@/lib/weather";
import { distanceKm, getSeedZones } from "@/lib/zones";
import { RiskApiResponse } from "@/types/climate";

const threshold = {
  flood: Number(process.env.ALERT_FLOOD_THRESHOLD ?? 0.7),
  heatwave: Number(process.env.ALERT_HEAT_THRESHOLD ?? 0.7),
  airQuality: Number(process.env.ALERT_AIR_THRESHOLD ?? 0.7),
};

const withinRange = (value: number, min: number, max: number): boolean => value >= min && value <= max;

export async function GET(request: NextRequest): Promise<NextResponse<RiskApiResponse | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat") ?? "20.5937");
  const lon = Number(searchParams.get("lon") ?? "78.9629");

  if (!withinRange(lat, -90, 90) || !withinRange(lon, -180, 180)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const seedZones = await getSeedZones();

  const zones = await Promise.all(
    seedZones.map(async (zone) => {
      const weather = await getWeatherSnapshot(zone.lat, zone.lon);
      const base = computeRiskBreakdown(weather);

      const proximity = distanceKm(lat, lon, zone.lat, zone.lon);
      const locationBoost = Math.max(0, 1 - proximity / 1800) * 0.12;

      const risks = {
        flood: Math.min(1, base.flood + locationBoost),
        heatwave: Math.min(1, base.heatwave + locationBoost * 0.8),
        airQuality: Math.min(1, base.airQuality + locationBoost * 0.5),
      };

      const overallScore = overallScoreFromBreakdown(risks);

      return {
        ...zone,
        risks,
        overallScore,
        riskLevel: riskLevelFromScore(overallScore),
        rationale: rationaleFromBreakdown(risks),
      };
    }),
  );

  const generatedAlerts = await appendAlerts(
    zones.flatMap((zone) => {
      const records: { zoneId: string; zoneName: string; riskType: "flood" | "heatwave" | "airQuality"; score: number; message: string }[] = [];

      if (zone.risks.flood >= threshold.flood) {
        records.push({
          zoneId: zone.id,
          zoneName: zone.name,
          riskType: "flood",
          score: zone.risks.flood,
          message: `Flood risk elevated in ${zone.name}.`,
        });
      }

      if (zone.risks.heatwave >= threshold.heatwave) {
        records.push({
          zoneId: zone.id,
          zoneName: zone.name,
          riskType: "heatwave",
          score: zone.risks.heatwave,
          message: `Heatwave risk elevated in ${zone.name}.`,
        });
      }

      if (zone.risks.airQuality >= threshold.airQuality) {
        records.push({
          zoneId: zone.id,
          zoneName: zone.name,
          riskType: "airQuality",
          score: zone.risks.airQuality,
          message: `Air quality risk elevated in ${zone.name}.`,
        });
      }

      return records;
    }),
  );

  const payload: RiskApiResponse = {
    queriedLocation: { lat, lon },
    generatedAt: new Date().toISOString(),
    zones: zones.sort((a, b) => b.overallScore - a.overallScore),
  };

  const response = NextResponse.json(payload);
  response.headers.set("x-generated-alerts", String(generatedAlerts.length));
  return response;
}
