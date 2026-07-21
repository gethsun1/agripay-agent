import type { DiseaseRisk, MarketIntelligence, ResourceId, WeatherRisk } from "@agripay/schemas";

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
    priceTinybars: 7_000_000n,
    description: "Demonstration crop disease-risk intelligence",
  },
  "market-intelligence": {
    id: "market-intelligence",
    path: "/api/resources/market-intelligence",
    priceTinybars: 4_000_000n,
    description: "Demonstration agricultural market intelligence",
  },
};

export const NANDI_MAIZE_DISEASE: DiseaseRisk = {
  county: "Nandi",
  crop: "maize",
  riskLevel: "moderate",
  factors: ["humid canopy after rainfall", "demonstration history of leaf-spot pressure"],
  scoutingActions: ["inspect lower leaves twice weekly", "record affected plants by field section"],
  preventionActions: ["use clean seed", "maintain field hygiene and recommended spacing"],
  confidence: "moderate",
  provenance: "curated demonstration fixture",
  fixtureVersion: "nandi-maize-disease-v1-2026-07",
  disclaimer: DEMO_DISCLOSURE,
};

export const NANDI_MAIZE_MARKET: MarketIntelligence = {
  county: "Nandi",
  commodity: "maize",
  priceRangeKesPer90Kg: { min: 3200, max: 3700 },
  demand: "steady",
  supply: "balanced",
  timing: "The demonstration scenario favours comparing buyer quotes before staggered sales.",
  risks: [
    "fixture prices are not live quotes",
    "transport and moisture deductions can alter proceeds",
  ],
  provenance: "curated demonstration fixture",
  fixtureVersion: "nandi-maize-market-v1-2026-07",
  disclaimer: DEMO_DISCLOSURE,
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

export function getDiseaseFixture(county: string, crop: string): DiseaseRisk | undefined {
  return county.toLowerCase() === "nandi" && crop.toLowerCase() === "maize"
    ? NANDI_MAIZE_DISEASE
    : undefined;
}

export function getMarketFixture(
  county: string,
  commodity: string,
): MarketIntelligence | undefined {
  return county.toLowerCase() === "nandi" && commodity.toLowerCase() === "maize"
    ? NANDI_MAIZE_MARKET
    : undefined;
}
