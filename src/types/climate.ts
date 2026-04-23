export type RiskLevel = "low" | "moderate" | "high" | "extreme";

export interface RiskBreakdown {
  flood: number;
  heatwave: number;
  airQuality: number;
}

export interface ZoneRisk {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  countryCode: string;
  populationEstimate: number;
  zoneKind?: "capital" | "major-city";
  risks: RiskBreakdown;
  overallScore: number;
  riskLevel: RiskLevel;
  rationale: string[];
}

export interface RegionHighlight {
  label: "North America" | "South America" | "Australia";
  featuredZone: ZoneRisk;
  zonesCovered: number;
  countriesCovered: number;
}

export interface WeatherSnapshot {
  temperature2m: number;
  precipitation: number;
  precipitationProbability: number;
  windSpeed10m: number;
  humidity: number;
  pm25Estimate: number;
}

export interface RiskApiResponse {
  queriedLocation: {
    lat: number;
    lon: number;
  };
  generatedAt: string;
  zones: ZoneRisk[];
  featuredRegions: RegionHighlight[];
}

export interface AlertRecord {
  id: string;
  createdAt: string;
  zoneId: string;
  zoneName: string;
  riskType: keyof RiskBreakdown;
  score: number;
  message: string;
}
