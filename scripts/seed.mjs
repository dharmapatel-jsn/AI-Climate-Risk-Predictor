import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");

const zones = [
  {
    id: "in-delhi",
    name: "Delhi NCR",
    lat: 28.6139,
    lon: 77.209,
    radiusKm: 35,
    countryCode: "IN",
    populationEstimate: 32000000,
  },
  {
    id: "ng-lagos",
    name: "Lagos Coastal Belt",
    lat: 6.5244,
    lon: 3.3792,
    radiusKm: 30,
    countryCode: "NG",
    populationEstimate: 21000000,
  },
  {
    id: "id-jakarta",
    name: "Jakarta Basin",
    lat: -6.2088,
    lon: 106.8456,
    radiusKm: 32,
    countryCode: "ID",
    populationEstimate: 11000000,
  },
];

await mkdir(dataDir, { recursive: true });
await writeFile(path.join(dataDir, "mock-zones.json"), `${JSON.stringify(zones, null, 2)}\n`, "utf8");
await writeFile(path.join(dataDir, "alerts.json"), "[]\n", "utf8");

console.log("Seed complete: data/mock-zones.json and data/alerts.json generated.");
