import type { ResourceId } from "@agripay/schemas";

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
