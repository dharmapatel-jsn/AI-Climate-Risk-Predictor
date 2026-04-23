import { readFile } from "node:fs/promises";
import path from "node:path";

interface SeedZone {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  countryCode: string;
  populationEstimate: number;
}

export async function getSeedZones(): Promise<SeedZone[]> {
  const filePath = path.join(process.cwd(), "data", "mock-zones.json");
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as SeedZone[];
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
