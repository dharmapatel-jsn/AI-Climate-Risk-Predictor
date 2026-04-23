import seedZones from "../../data/mock-zones.json";

export interface SeedZone {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  countryCode: string;
  populationEstimate: number;
  zoneKind?: "capital" | "major-city";
}

export interface PrioritizedZone extends SeedZone {
  distanceKm: number;
}

export async function getSeedZones(): Promise<SeedZone[]> {
  return seedZones as SeedZone[];
}

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

export function selectRelevantZones(
  zones: SeedZone[],
  targetLat: number,
  targetLon: number,
  maxZones = 220,
): PrioritizedZone[] {
  const withDistance = zones.map((zone) => ({
    ...zone,
    distanceKm: distanceKm(targetLat, targetLon, zone.lat, zone.lon),
  }));

  const maxPopulation = Math.max(...withDistance.map((zone) => zone.populationEstimate), 1);

  withDistance.sort((a, b) => {
    const aDistanceScore = Math.min(1, a.distanceKm / 8000);
    const bDistanceScore = Math.min(1, b.distanceKm / 8000);
    const aPopulationScore = 1 - Math.min(1, a.populationEstimate / maxPopulation);
    const bPopulationScore = 1 - Math.min(1, b.populationEstimate / maxPopulation);

    const aScore = aDistanceScore * 0.75 + aPopulationScore * 0.25;
    const bScore = bDistanceScore * 0.75 + bPopulationScore * 0.25;

    return aScore - bScore;
  });

  return withDistance.slice(0, Math.max(50, Math.min(maxZones, zones.length)));
}
