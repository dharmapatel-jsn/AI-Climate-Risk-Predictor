import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import allCities from "all-the-cities";

const root = process.cwd();
const dataDir = path.join(root, "data");

const CAPITALS_API = "https://restcountries.com/v3.1/all?fields=cca2,capital,capitalInfo,population";
const MAJOR_CITY_POPULATION_THRESHOLD = 500000;

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

const radiusFromPopulation = (population) => {
  if (population >= 10000000) return 36;
  if (population >= 5000000) return 30;
  if (population >= 2000000) return 24;
  if (population >= 1000000) return 20;
  return 16;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchCapitalsWithRetry() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(CAPITALS_API);
      if (!response.ok) throw new Error(`status ${response.status}`);
      return await response.json();
    } catch {
      if (attempt === 3) return null;
      await sleep(600 * attempt);
    }
  }
  return null;
}

const citiesByCountry = new Map();
const capitalsByCountryFromCities = new Map();
for (const city of allCities) {
  const [lon, lat] = city?.loc?.coordinates ?? [];
  const population = Number(city.population ?? 0);

  if (!city.country || !inRange(lat, -90, 90) || !inRange(lon, -180, 180)) continue;

  if (city.featureCode === "PPLC") {
    const current = capitalsByCountryFromCities.get(city.country);
    if (!current || population > current.population) {
      capitalsByCountryFromCities.set(city.country, {
        name: city.name,
        lat,
        lon,
        population,
      });
    }
  }

  if (population < MAJOR_CITY_POPULATION_THRESHOLD) continue;
  if (!String(city.featureCode || "").startsWith("PPL")) continue;

  const bucket = citiesByCountry.get(city.country) ?? [];
  bucket.push({
    name: city.name,
    lat,
    lon,
    population,
  });
  citiesByCountry.set(city.country, bucket);
}

for (const [countryCode, bucket] of citiesByCountry.entries()) {
  bucket.sort((a, b) => b.population - a.population);
  citiesByCountry.set(countryCode, bucket);
}

const countries = await fetchCapitalsWithRetry();
const seen = new Set();
const zones = [];

const allCountryCodes = new Set([...citiesByCountry.keys(), ...capitalsByCountryFromCities.keys()]);

if (countries) {
  for (const country of countries) {
    const countryCode = country.cca2;
    if (!countryCode) continue;
    allCountryCodes.add(countryCode);

    const capitalName = Array.isArray(country.capital) ? country.capital[0] : null;
    const capitalCoords = country?.capitalInfo?.latlng;

    if (capitalName && Array.isArray(capitalCoords) && capitalCoords.length >= 2) {
      const lat = Number(capitalCoords[0]);
      const lon = Number(capitalCoords[1]);
      if (inRange(lat, -90, 90) && inRange(lon, -180, 180)) {
        const key = `${countryCode}:${capitalName.toLowerCase()}`;
        seen.add(key);
        zones.push({
          id: `capital-${slugify(countryCode)}-${slugify(capitalName)}`,
          name: `${capitalName} (Capital)`,
          lat,
          lon,
          radiusKm: radiusFromPopulation(Number(country.population ?? 1500000)),
          countryCode,
          populationEstimate: Number(country.population ?? 0),
          zoneKind: "capital",
        });
      }
    }
  }
}

for (const countryCode of allCountryCodes) {
  const fallbackCapital = capitalsByCountryFromCities.get(countryCode);
  if (fallbackCapital) {
    const capitalKey = `${countryCode}:${fallbackCapital.name.toLowerCase()}`;
    if (!seen.has(capitalKey)) {
      seen.add(capitalKey);
      zones.push({
        id: `capital-${slugify(countryCode)}-${slugify(fallbackCapital.name)}`,
        name: `${fallbackCapital.name} (Capital)`,
        lat: fallbackCapital.lat,
        lon: fallbackCapital.lon,
        radiusKm: radiusFromPopulation(fallbackCapital.population),
        countryCode,
        populationEstimate: fallbackCapital.population,
        zoneKind: "capital",
      });
    }
  }

  const majorCities = citiesByCountry.get(countryCode) ?? [];
  for (const city of majorCities) {
    const key = `${countryCode}:${city.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    zones.push({
      id: `city-${slugify(countryCode)}-${slugify(city.name)}`,
      name: city.name,
      lat: city.lat,
      lon: city.lon,
      radiusKm: radiusFromPopulation(city.population),
      countryCode,
      populationEstimate: city.population,
      zoneKind: "major-city",
    });
  }
}

zones.sort((a, b) => b.populationEstimate - a.populationEstimate);

await mkdir(dataDir, { recursive: true });
await writeFile(path.join(dataDir, "mock-zones.json"), `${JSON.stringify(zones, null, 2)}\n`, "utf8");
await writeFile(path.join(dataDir, "alerts.json"), "[]\n", "utf8");

console.log(
  `Seed complete: ${zones.length} zones generated in data/mock-zones.json${
    countries ? "" : " (used offline capital fallback)"
  }`,
);
