import { WeatherSnapshot } from "@/types/climate";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minute cache
const MAX_CACHE_ENTRIES = 800;
const weatherCache = new Map<string, { data: WeatherSnapshot; timestamp: number }>();

const toNumber = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
};

const normalizeLat = (lat: number): number => clamp(lat, -90, 90);
const normalizeLon = (lon: number): number => {
  if (!Number.isFinite(lon)) return 0;
  const wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
};

const canonicalZero = (value: number): number => (Object.is(value, -0) ? 0 : value);
const normalizeCacheKey = (lat: number, lon: number): string => {
  const normalizedLat = canonicalZero(lat);
  const normalizedLon = canonicalZero(lon);
  return `${normalizedLat.toFixed(2)},${normalizedLon.toFixed(2)}`;
};

const enforceCacheLimit = (): void => {
  if (weatherCache.size <= MAX_CACHE_ENTRIES) return;
  const oldest = weatherCache.keys().next().value;
  if (oldest) weatherCache.delete(oldest);
};

const estimatePm25 = (temperature2m: number): number => {
  return Math.max(8, Math.min(140, 14 + temperature2m * 0.8));
};

export async function getWeatherSnapshot(lat: number, lon: number): Promise<WeatherSnapshot> {
  const normalizedLat = normalizeLat(lat);
  const normalizedLon = normalizeLon(lon);
  const cacheKey = normalizeCacheKey(normalizedLat, normalizedLon);
  const cached = weatherCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return cached.data;
  }

  const query = new URLSearchParams({
    latitude: String(normalizedLat),
    longitude: String(normalizedLon),
    current: "temperature_2m,precipitation,relative_humidity_2m,wind_speed_10m",
    hourly: "precipitation_probability",
    timezone: "auto",
    forecast_days: "1",
  });

  const airQuery = new URLSearchParams({
    latitude: String(normalizedLat),
    longitude: String(normalizedLon),
    current: "pm2_5",
    timezone: "auto",
  });

  try {
    const [weatherResponse, airPayload] = await Promise.all([
      fetch(`${OPEN_METEO_URL}?${query.toString()}`),
      fetch(`${OPEN_METEO_AIR_URL}?${airQuery.toString()}`)
        .then(async (response) => {
          if (!response.ok) return null;
          return response.json();
        })
        .catch(() => null),
    ]);

    if (!weatherResponse.ok) throw new Error(`Open-Meteo error: ${weatherResponse.status}`);

    const data = await weatherResponse.json();
    const current = data?.current ?? {};
    const hourly = data?.hourly ?? {};
    const rawPrecipitationProbability = Array.isArray(hourly?.precipitation_probability)
      ? toNumber(hourly.precipitation_probability[0], 20)
      : 20;
    const precipitationProbability = clamp(rawPrecipitationProbability, 0, 100);

    const temperature2m = toNumber(current.temperature_2m, 29);
    const observedPm25 = toNumber(airPayload?.current?.pm2_5, Number.NaN);
    const pm25Estimate = Number.isFinite(observedPm25)
      ? Math.max(0, observedPm25)
      : estimatePm25(temperature2m);

    const snapshot: WeatherSnapshot = {
      temperature2m,
      precipitation: Math.max(0, toNumber(current.precipitation, 1.5)),
      precipitationProbability,
      windSpeed10m: Math.max(0, toNumber(current.wind_speed_10m, 4)),
      humidity: clamp(toNumber(current.relative_humidity_2m, 58), 0, 100),
      pm25Estimate,
    };

    weatherCache.set(cacheKey, { data: snapshot, timestamp: Date.now() });
    enforceCacheLimit();
    return snapshot;
  } catch {
    const fallback: WeatherSnapshot = {
      temperature2m: 31,
      precipitation: 4,
      precipitationProbability: 45,
      windSpeed10m: 5,
      humidity: 62,
      pm25Estimate: 24,
    };
    weatherCache.set(cacheKey, { data: fallback, timestamp: Date.now() });
    enforceCacheLimit();
    return fallback;
  }
}
