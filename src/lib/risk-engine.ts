import type { AlertRecord, RegionHighlight, RiskApiResponse, ZoneRisk } from "@/types/climate";
import { computeRiskBreakdown, overallScoreFromBreakdown, rationaleFromBreakdown, riskLevelFromScore } from "@/lib/risk-utils";
import { getWeatherSnapshot } from "@/lib/weather";
import { distanceKm, getSeedZones, selectRelevantZones, type PrioritizedZone, type SeedZone } from "@/lib/zones";

const DEFAULT_THRESHOLDS = {
  flood: 0.7,
  heatwave: 0.7,
  airQuality: 0.7,
};

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
};

const parseThreshold = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0 || parsed > 1) return fallback;
  return parsed;
};

const normalizeLat = (value: number): number => clamp(value, -90, 90);
const normalizeLon = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
};

const normalizeMaxZones = (value: number): number => {
  if (!Number.isFinite(value)) return 220;
  return Math.floor(clamp(value, 50, 1000));
};

const threshold = {
  flood: parseThreshold(process.env.NEXT_PUBLIC_ALERT_FLOOD_THRESHOLD, DEFAULT_THRESHOLDS.flood),
  heatwave: parseThreshold(process.env.NEXT_PUBLIC_ALERT_HEAT_THRESHOLD, DEFAULT_THRESHOLDS.heatwave),
  airQuality: parseThreshold(process.env.NEXT_PUBLIC_ALERT_AIR_THRESHOLD, DEFAULT_THRESHOLDS.airQuality),
};

type ScorableZone = Pick<PrioritizedZone, "id" | "name" | "lat" | "lon" | "radiusKm" | "countryCode" | "populationEstimate" | "zoneKind">;
type AlertType = "flood" | "heatwave" | "airQuality";

const EUROPE_COUNTRY_CODES = new Set([
  "AL",
  "AD",
  "AM",
  "AT",
  "AZ",
  "BY",
  "BE",
  "BA",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "GE",
  "DE",
  "GR",
  "HU",
  "IS",
  "IE",
  "IT",
  "XK",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "MD",
  "MC",
  "ME",
  "NL",
  "MK",
  "NO",
  "PL",
  "PT",
  "RO",
  "RU",
  "SM",
  "RS",
  "SK",
  "SI",
  "ES",
  "SE",
  "CH",
  "TR",
  "UA",
  "GB",
  "VA",
]);

const TARGET_CITY_COUNTRY_CODES = new Set(["US", "CA", "AU", ...EUROPE_COUNTRY_CODES]);

const targetRegionPerCountryCap = (countryCode: string): number => {
  if (countryCode === "US") return 12;
  if (countryCode === "CA") return 8;
  if (countryCode === "AU") return 8;
  return 2;
};

function representativeByCountry(seedZones: SeedZone[]): Map<string, SeedZone> {
  const byCountry = new Map<string, SeedZone>();

  for (const zone of seedZones) {
    const current = byCountry.get(zone.countryCode);
    if (!current) {
      byCountry.set(zone.countryCode, zone);
      continue;
    }

    const zonePriority = (zone.zoneKind === "capital" ? 2 : 0) + zone.populationEstimate / 10_000_000;
    const currentPriority =
      (current.zoneKind === "capital" ? 2 : 0) + current.populationEstimate / 10_000_000;

    if (zonePriority > currentPriority) {
      byCountry.set(zone.countryCode, zone);
    }
  }

  return byCountry;
}

function ensureCountryCoverage(
  seedZones: SeedZone[],
  selected: PrioritizedZone[],
  targetLat: number,
  targetLon: number,
): PrioritizedZone[] {
  const selectedById = new Map(selected.map((zone) => [zone.id, zone]));
  const selectedCountries = new Set(selected.map((zone) => zone.countryCode));
  const countryRepresentatives = representativeByCountry(seedZones);

  for (const [countryCode, zone] of countryRepresentatives.entries()) {
    if (selectedCountries.has(countryCode) || selectedById.has(zone.id)) continue;

    selectedById.set(zone.id, {
      ...zone,
      distanceKm: distanceKm(targetLat, targetLon, zone.lat, zone.lon),
    });
  }

  return Array.from(selectedById.values());
}

function ensureTargetRegionCoverage(
  seedZones: SeedZone[],
  selected: PrioritizedZone[],
  targetLat: number,
  targetLon: number,
  maxAdditionalCities = 80,
): PrioritizedZone[] {
  const selectedById = new Map(selected.map((zone) => [zone.id, zone]));
  const candidateCitiesByCountry = new Map<string, SeedZone[]>();

  for (const zone of seedZones) {
    if (zone.zoneKind !== "major-city") continue;
    if (!TARGET_CITY_COUNTRY_CODES.has(zone.countryCode)) continue;
    if (selectedById.has(zone.id)) continue;

    const bucket = candidateCitiesByCountry.get(zone.countryCode) ?? [];
    bucket.push(zone);
    candidateCitiesByCountry.set(zone.countryCode, bucket);
  }

  for (const bucket of candidateCitiesByCountry.values()) {
    bucket.sort((a, b) => b.populationEstimate - a.populationEstimate);
  }

  const priorityCountries = ["US", "CA", "AU"];
  const remainingCountries = Array.from(candidateCitiesByCountry.keys())
    .filter((countryCode) => !priorityCountries.includes(countryCode))
    .sort((a, b) => a.localeCompare(b));
  const countryOrder = [...priorityCountries, ...remainingCountries].filter((countryCode) =>
    candidateCitiesByCountry.has(countryCode),
  );

  const addedByCountry = new Map<string, number>();
  let added = 0;

  for (let round = 0; added < maxAdditionalCities; round += 1) {
    let addedThisRound = 0;

    for (const countryCode of countryOrder) {
      if (added >= maxAdditionalCities) break;

      const currentCount = addedByCountry.get(countryCode) ?? 0;
      const cap = targetRegionPerCountryCap(countryCode);
      if (currentCount >= cap) continue;

      const bucket = candidateCitiesByCountry.get(countryCode) ?? [];
      const candidate = bucket[round];
      if (!candidate) continue;

      selectedById.set(candidate.id, {
        ...candidate,
        distanceKm: distanceKm(targetLat, targetLon, candidate.lat, candidate.lon),
      });
      addedByCountry.set(countryCode, currentCount + 1);
      added += 1;
      addedThisRound += 1;
    }

    if (addedThisRound === 0) break;
  }

  return Array.from(selectedById.values());
}

const REGION_COUNTRY_CODES: Record<RegionHighlight["label"], string[]> = {
  "North America": ["US", "CA", "MX", "GT", "CU", "CR", "PA", "PR", "DO", "HN", "NI", "SV", "JM", "BS", "BB", "TT"],
  "South America": ["BR", "AR", "CL", "PE", "CO", "EC", "BO", "UY", "PY", "VE", "GY", "SR"],
  Australia: ["AU", "NZ", "PG", "FJ", "SB", "VU", "NC", "WS", "TO", "KI", "TV", "NR", "PW", "FM", "MH"],
};

const scoreZone = async (zone: ScorableZone, locationBoost = 0): Promise<ZoneRisk> => {
  const weather = await getWeatherSnapshot(zone.lat, zone.lon);
  const base = computeRiskBreakdown(weather);
  const safeBoost = clamp(locationBoost, 0, 0.25);

  const risks = {
    flood: Math.min(1, base.flood + safeBoost),
    heatwave: Math.min(1, base.heatwave + safeBoost * 0.8),
    airQuality: Math.min(1, base.airQuality + safeBoost * 0.5),
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

const createAlertRecord = (zone: ZoneRisk, riskType: AlertType, message: string, generatedAt: string): AlertRecord => ({
  id: `${zone.id}-${riskType}-${generatedAt}`,
  createdAt: generatedAt,
  zoneId: zone.id,
  zoneName: zone.name,
  riskType,
  score: zone.risks[riskType],
  message,
});

const buildAlerts = (zones: ZoneRisk[], generatedAt: string): AlertRecord[] => {
  const records = zones.flatMap((zone) => {
    const zoneRecords: AlertRecord[] = [];

    if (zone.risks.flood >= threshold.flood) {
      zoneRecords.push(createAlertRecord(zone, "flood", `Flood risk elevated in ${zone.name}.`, generatedAt));
    }

    if (zone.risks.heatwave >= threshold.heatwave) {
      zoneRecords.push(createAlertRecord(zone, "heatwave", `Heatwave risk elevated in ${zone.name}.`, generatedAt));
    }

    if (zone.risks.airQuality >= threshold.airQuality) {
      zoneRecords.push(createAlertRecord(zone, "airQuality", `Air quality risk elevated in ${zone.name}.`, generatedAt));
    }

    return zoneRecords;
  });

  records.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const zoneCompare = a.zoneName.localeCompare(b.zoneName);
    if (zoneCompare !== 0) return zoneCompare;
    return a.riskType.localeCompare(b.riskType);
  });

  return records;
};

export interface RiskSnapshot extends RiskApiResponse {
  alerts: AlertRecord[];
}

export async function loadRiskSnapshot(lat: number, lon: number, maxZones = 400): Promise<RiskSnapshot> {
  const normalizedLat = normalizeLat(lat);
  const normalizedLon = normalizeLon(lon);
  const normalizedMaxZones = normalizeMaxZones(maxZones);
  const generatedAt = new Date().toISOString();

  const seedZones = await getSeedZones();
  const prioritizedZones = selectRelevantZones(seedZones, normalizedLat, normalizedLon, normalizedMaxZones);
  const countryCoveredZones = ensureCountryCoverage(seedZones, prioritizedZones, normalizedLat, normalizedLon);
  const selectedZones = ensureTargetRegionCoverage(seedZones, countryCoveredZones, normalizedLat, normalizedLon);

  const [zones, featuredRegions] = await Promise.all([
    Promise.all(
      selectedZones.map(async (zone) => {
        const locationBoost = Math.max(0, 1 - zone.distanceKm / 1800) * 0.12;
        return scoreZone(zone, locationBoost);
      }),
    ),
    buildRegionHighlights(seedZones),
  ]);

  const sortedZones = zones.sort((a, b) => {
    if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
    if (b.populationEstimate !== a.populationEstimate) return b.populationEstimate - a.populationEstimate;
    return a.name.localeCompare(b.name);
  });

  return {
    queriedLocation: { lat: normalizedLat, lon: normalizedLon },
    generatedAt,
    zones: sortedZones,
    featuredRegions,
    alerts: buildAlerts(sortedZones, generatedAt),
  };
}