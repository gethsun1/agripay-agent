import type { ResourceId, WeatherRisk } from "@agripay/schemas";

export interface ResourceDefinition {
  id: ResourceId;
  path: string;
  priceTinybars: bigint;
  description: string;
}

export const DEMO_DISCLOSURE =
  "Curated demonstration intelligence; not meteorological, agronomic, financial, or market advice.";

export const RESOURCE_REGISTRY: Readonly<Record<ResourceId, ResourceDefinition>> = {
  "weather-risk": {
    id: "weather-risk",
    path: "/api/resources/weather-risk",
    priceTinybars: 5_000_000n,
    description: "Demonstration weather and planting-risk intelligence",
  },
  "disease-risk": {
    id: "disease-risk",
    path: "/api/resources/disease-risk",
    priceTinybars: 5_000_000n,
    description: "Demonstration crop disease-risk intelligence",
  },
  "market-intelligence": {
    id: "market-intelligence",
    path: "/api/resources/market-intelligence",
    priceTinybars: 5_000_000n,
    description: "Demonstration agricultural market intelligence",
  },
};

export const NANDI_MAIZE_WEATHER: WeatherRisk = {
  county: "Nandi",
  crop: "maize",
  sevenDaySummary:
    "Demonstration conditions indicate two early wet days, a short drying window, and moderate late-week showers.",
  rainfallOutlook: "favourable",
  soilMoistureOutlook: "adequate",
  temperatureRisk: "low",
  plantingRecommendation:
    "For the demonstration scenario, prepare fields now and plant during the drying window if local field conditions are suitable.",
  riskFlags: [
    "short intense shower may cause localised runoff",
    "verify actual soil trafficability",
  ],
  provenance: "curated demonstration fixture",
  fixtureVersion: "nandi-maize-v1-2026-07",
  disclaimer:
    "Demonstration intelligence only; not live meteorological or agronomic data and not professional advice.",
};

export function getWeatherFixture(county: string, crop: string): WeatherRisk | undefined {
  return county.toLowerCase() === "nandi" && crop.toLowerCase() === "maize"
    ? NANDI_MAIZE_WEATHER
    : undefined;
}
