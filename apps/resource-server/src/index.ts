import { createServer, type Server } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import {
  getDiseaseFixture,
  getMarketFixture,
  getWeatherFixture,
  RESOURCE_REGISTRY,
} from "@agripay/fixtures";
import { DurableStore } from "@agripay/storage";
import {
  paymentPayloadSchema,
  resourceIdSchema,
  type PaymentRequirements,
  type ResourceId,
} from "@agripay/schemas";

const paymentHeader = "x-payment";

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function requirements(
  sellerAccountId: string,
  facilitatorAccountId: string,
  now: Date,
  resourceId: ResourceId,
): PaymentRequirements {
  const resource = RESOURCE_REGISTRY[resourceId];
  return {
    scheme: "exact",
    network: "hedera-testnet",
    asset: "HBAR",
    maxAmountRequired: resource.priceTinybars.toString(),
    payTo: sellerAccountId,
    resource: resource.id,
    description: resource.description,
    expiresAt: new Date(now.getTime() + 120_000).toISOString(),
    nonce: randomBytes(16).toString("hex"),
    extra: { feePayer: facilitatorAccountId },
  };
}

export interface ResourceServerOptions {
  sellerAccountId: string;
  facilitatorAccountId: string;
  facilitatorUrl: string;
  now?: () => Date;
  store?: DurableStore;
}

export function createResourceServer(options: ResourceServerOptions): Server {
  const store = options.store ?? new DurableStore(":memory:");
  return createServer((request, response) => {
    void (async () => {
      response.setHeader("content-type", "application/json");
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/health") {
        response.end(JSON.stringify({ status: "ok" }));
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/resources/catalogue") {
        response.end(
          JSON.stringify(
            Object.values(RESOURCE_REGISTRY).map((r) => ({
              ...r,
              priceTinybars: r.priceTinybars.toString(),
            })),
          ),
        );
        return;
      }
      const matched = Object.values(RESOURCE_REGISTRY).find((r) => r.path === url.pathname);
      if (request.method !== "GET" || !matched) {
        response.statusCode = 404;
        response.end(JSON.stringify({ error: "not_found" }));
        return;
      }
      const county = url.searchParams.get("county");
      const subject = url.searchParams.get(
        matched.id === "market-intelligence" ? "commodity" : "crop",
      );
      if (!county || !subject) {
        response.statusCode = 400;
        response.end(
          JSON.stringify({
            error:
              matched.id === "market-intelligence"
                ? "county_and_commodity_are_required"
                : "county_and_crop_are_required",
          }),
        );
        return;
      }
      const resourceId = resourceIdSchema.parse(matched.id);
      const fixture =
        resourceId === "weather-risk"
          ? getWeatherFixture(county, subject)
          : resourceId === "disease-risk"
            ? getDiseaseFixture(county, subject)
            : getMarketFixture(county, subject);
      if (!fixture) {
        response.statusCode = 404;
        response.end(JSON.stringify({ error: "demonstration_fixture_not_found" }));
        return;
      }
      const supplied = request.headers[paymentHeader];
      const suppliedDigest = request.headers["x-agripay-payment-digest"];
      if (typeof supplied !== "string" && typeof suppliedDigest !== "string") {
        const challenge = requirements(
          options.sellerAccountId,
          options.facilitatorAccountId,
          options.now?.() ?? new Date(),
          resourceId,
        );
        store.saveChallenge(
          challenge.nonce,
          createHash("sha256").update(JSON.stringify(challenge)).digest("hex"),
          challenge,
        );
        response.statusCode = 402;
        response.setHeader("cache-control", "no-store");
        response.end(JSON.stringify({ x402Version: 1, accepts: [challenge] }));
        return;
      }
      try {
        const digest =
          typeof suppliedDigest === "string"
            ? suppliedDigest
            : createHash("sha256")
                .update(
                  paymentPayloadSchema.parse(
                    JSON.parse(Buffer.from(String(supplied), "base64").toString("utf8")) as unknown,
                  ).payload.transaction,
                )
                .digest("hex");
        const nonce = request.headers["x-agripay-payment-nonce"];
        if (typeof nonce !== "string") throw new Error("missing_nonce");
        const challengeRow = store.getChallenge(nonce);
        if (!challengeRow) throw new Error("unknown_challenge");
        if (typeof challengeRow.requirement_json !== "string") throw new Error("invalid_challenge");
        const status = await fetch(`${options.facilitatorUrl}/status`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nonce,
            digest,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        const result = (await status.json()) as { state?: string; transactionId?: string };
        if (result.state === "ambiguous") {
          response.statusCode = 503;
          response.end(JSON.stringify({ error: "settlement_ambiguous" }));
          return;
        }
        if (!status.ok || result.state !== "settled") throw new Error("settlement_failed");
        store.consumeChallenge(nonce);
        response.statusCode = 200;
        response.setHeader("x-payment-response", encode(result));
        response.end(JSON.stringify(fixture));
      } catch {
        response.statusCode = 402;
        response.end(JSON.stringify({ error: "payment_not_verified" }));
      }
    })();
  });
}
