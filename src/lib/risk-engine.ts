import type { AlertRecord, RegionHighlight, RiskApiResponse, ZoneRisk } from "@/types/climate";
import { computeRiskBreakdown, overallScoreFromBreakdown, rationaleFromBreakdown, riskLevelFromScore } from "@/lib/risk-utils";
import { getWeatherSnapshot } from "@/lib/weather";
import { getSeedZones, selectRelevantZones, type PrioritizedZone } from "@/lib/zones";

const threshold = {
  flood: 0.7,
  heatwave: 0.7,
  airQuality: 0.7,
};

type ScorableZone = Pick<PrioritizedZone, "id" | "name" | "lat" | "lon" | "radiusKm" | "countryCode" | "populationEstimate" | "zoneKind">;
type AlertType = "flood" | "heatwave" | "airQuality";

const REGION_COUNTRY_CODES: Record<RegionHighlight["label"], string[]> = {
  "North America": ["US", "CA", "MX", "GT", "CU", "CR", "PA", "PR", "DO", "HN", "NI", "SV", "JM", "BS", "BB", "TT"],
  "South America": ["BR", "AR", "CL", "PE", "CO", "EC", "BO", "UY", "PY", "VE", "GY", "SR"],
  Australia: ["AU", "NZ", "PG", "FJ", "SB", "VU", "NC", "WS", "TO", "KI", "TV", "NR", "PW", "FM", "MH"],
};

const scoreZone = async (zone: ScorableZone, locationBoost = 0): Promise<ZoneRisk> => {
  const weather = await getWeatherSnapshot(zone.lat, zone.lon);
  const base = computeRiskBreakdown(weather);

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
};

const buildRegionHighlights = async (seedZones: ScorableZone[]): Promise<RegionHighlight[]> => {
  const highlights = await Promise.all(
    (Object.keys(REGION_COUNTRY_CODES) as RegionHighlight["label"][]).map(async (label) => {
      const regionZones = seedZones.filter((zone) => REGION_COUNTRY_CODES[label].includes(zone.countryCode));

      if (!regionZones.length) return null;

      const representative = [...regionZones].sort((a, b) => b.populationEstimate - a.populationEstimate)[0];
      const featuredZone = await scoreZone(representative, 0);
      const countriesCovered = new Set(regionZones.map((zone) => zone.countryCode)).size;

      return {
        label,
        featuredZone,
        zonesCovered: regionZones.length,
        countriesCovered,
      };
    }),
  );

  return highlights.filter((highlight): highlight is RegionHighlight => Boolean(highlight));
};

const createAlertRecord = (zone: ZoneRisk, riskType: AlertType, message: string): AlertRecord => ({
  id: `${zone.id}-${riskType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  createdAt: new Date().toISOString(),
  zoneId: zone.id,
  zoneName: zone.name,
  riskType,
  score: zone.risks[riskType],
  message,
});

const buildAlerts = (zones: ZoneRisk[]): AlertRecord[] => {
  return zones.flatMap((zone) => {
    const records: AlertRecord[] = [];

    if (zone.risks.flood >= threshold.flood) {
      records.push(createAlertRecord(zone, "flood", `Flood risk elevated in ${zone.name}.`));
    }

    if (zone.risks.heatwave >= threshold.heatwave) {
      records.push(createAlertRecord(zone, "heatwave", `Heatwave risk elevated in ${zone.name}.`));
    }

    if (zone.risks.airQuality >= threshold.airQuality) {
      records.push(createAlertRecord(zone, "airQuality", `Air quality risk elevated in ${zone.name}.`));
    }

    return records;
  });
};

export interface RiskSnapshot extends RiskApiResponse {
  alerts: AlertRecord[];
}

export async function loadRiskSnapshot(lat: number, lon: number, maxZones = 400): Promise<RiskSnapshot> {
  const seedZones = await getSeedZones();
  const selectedZones = selectRelevantZones(seedZones, lat, lon, maxZones);

  const [zones, featuredRegions] = await Promise.all([
    Promise.all(
      selectedZones.map(async (zone) => {
        const locationBoost = Math.max(0, 1 - zone.distanceKm / 1800) * 0.12;
        return scoreZone(zone, locationBoost);
      }),
    ),
    buildRegionHighlights(seedZones),
  ]);

  const sortedZones = zones.sort((a, b) => b.overallScore - a.overallScore);

  return {
    queriedLocation: { lat, lon },
    generatedAt: new Date().toISOString(),
    zones: sortedZones,
    featuredRegions,
    alerts: buildAlerts(sortedZones),
  };
}