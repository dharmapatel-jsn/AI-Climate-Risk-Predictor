import { WeatherSnapshot } from "@/types/climate";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

const toNumber = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export async function getWeatherSnapshot(lat: number, lon: number): Promise<WeatherSnapshot> {
  const query = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,precipitation,relative_humidity_2m,wind_speed_10m",
    hourly: "precipitation_probability",
    timezone: "auto",
    forecast_days: "1",
  });

  try {
    const response = await fetch(`${OPEN_METEO_URL}?${query.toString()}`);
    if (!response.ok) throw new Error(`Open-Meteo error: ${response.status}`);

    const data = await response.json();
    const current = data?.current ?? {};
    const hourly = data?.hourly ?? {};
    const precipitationProbability = Array.isArray(hourly?.precipitation_probability)
      ? toNumber(hourly.precipitation_probability[0], 20)
      : 20;

    const syntheticPm25 = Math.max(8, Math.min(140, 14 + toNumber(current.temperature_2m, 25) * 0.8));

    return {
      temperature2m: toNumber(current.temperature_2m, 29),
      precipitation: toNumber(current.precipitation, 1.5),
      precipitationProbability,
      windSpeed10m: toNumber(current.wind_speed_10m, 4),
      humidity: toNumber(current.relative_humidity_2m, 58),
      pm25Estimate: syntheticPm25,
    };
  } catch {
    return {
      temperature2m: 31,
      precipitation: 4,
      precipitationProbability: 45,
      windSpeed10m: 5,
      humidity: 62,
      pm25Estimate: 24,
    };
  }
}
