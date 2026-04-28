import { RiskBreakdown, RiskLevel, WeatherSnapshot } from "@/types/climate";

const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, value));

export const RISK_LEVEL_THRESHOLDS = {
  moderate: 0.4,
  high: 0.65,
  extreme: 0.85,
} as const;

const scale = (value: number, min: number, max: number): number => {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min));
};

export const riskLevelFromScore = (score: number): RiskLevel => {
  if (score >= RISK_LEVEL_THRESHOLDS.extreme) return "extreme";
  if (score >= RISK_LEVEL_THRESHOLDS.high) return "high";
  if (score >= RISK_LEVEL_THRESHOLDS.moderate) return "moderate";
  return "low";
};

export const computeRiskBreakdown = (weather: WeatherSnapshot): RiskBreakdown => {
  const flood = clamp(
    0.55 * scale(weather.precipitation, 8, 60) +
      0.3 * scale(weather.precipitationProbability, 35, 100) +
      0.15 * scale(weather.humidity, 65, 100),
  );

  const heatwave = clamp(
    0.7 * scale(weather.temperature2m, 30, 48) +
      0.2 * scale(weather.humidity, 60, 95) +
      0.1 * scale(weather.windSpeed10m, 0, 8),
  );

  const airQuality = clamp(
    0.75 * scale(weather.pm25Estimate, 18, 120) +
      0.25 * scale(weather.windSpeed10m, 0, 5),
  );

  return { flood, heatwave, airQuality };
};

export const overallScoreFromBreakdown = (risks: RiskBreakdown): number => {
  return clamp(risks.flood * 0.35 + risks.heatwave * 0.4 + risks.airQuality * 0.25);
};

export const rationaleFromBreakdown = (risks: RiskBreakdown): string[] => {
  const notes: string[] = [];

  if (risks.flood >= 0.65) notes.push("High rainfall intensity increases flood exposure.");
  if (risks.heatwave >= 0.65) notes.push("Temperature and humidity profile indicates heat stress risk.");
  if (risks.airQuality >= 0.65) notes.push("Estimated PM2.5 concentration suggests unhealthy air quality windows.");
  if (notes.length === 0) notes.push("Current conditions indicate manageable risk levels.");

  return notes;
};
