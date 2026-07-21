import { createServer, type Server } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { getWeatherFixture, RESOURCE_REGISTRY } from "@agripay/fixtures";
import { paymentPayloadSchema, type PaymentRequirements } from "@agripay/schemas";

const paymentHeader = "x-payment";

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function requirements(
  sellerAccountId: string,
  facilitatorAccountId: string,
  now: Date,
): PaymentRequirements {
  const resource = RESOURCE_REGISTRY["weather-risk"];
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
}

export function createResourceServer(options: ResourceServerOptions): Server {
  const challenges = new Map<string, PaymentRequirements>();
  return createServer((request, response) => {
    void (async () => {
      response.setHeader("content-type", "application/json");
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method !== "GET" || url.pathname !== "/api/resources/weather-risk") {
        response.statusCode = 404;
        response.end(JSON.stringify({ error: "not_found" }));
        return;
      }
      const county = url.searchParams.get("county");
      const crop = url.searchParams.get("crop");
      if (!county || !crop) {
        response.statusCode = 400;
        response.end(JSON.stringify({ error: "county_and_crop_are_required" }));
        return;
      }
      const fixture = getWeatherFixture(county, crop);
      if (!fixture) {
        response.statusCode = 404;
        response.end(JSON.stringify({ error: "demonstration_fixture_not_found" }));
        return;
      }
      const supplied = request.headers[paymentHeader];
      if (typeof supplied !== "string") {
        const challenge = requirements(
          options.sellerAccountId,
          options.facilitatorAccountId,
          options.now?.() ?? new Date(),
        );
        challenges.set(challenge.nonce, challenge);
        response.statusCode = 402;
        response.setHeader("cache-control", "no-store");
        response.end(JSON.stringify({ x402Version: 1, accepts: [challenge] }));
        return;
      }
      try {
        const payload = paymentPayloadSchema.parse(
          JSON.parse(Buffer.from(supplied, "base64").toString("utf8")) as unknown,
        );
        const nonce = request.headers["x-agripay-payment-nonce"];
        if (typeof nonce !== "string") throw new Error("missing_nonce");
        const challenge = challenges.get(nonce);
        if (!challenge) throw new Error("unknown_challenge");
        const status = await fetch(`${options.facilitatorUrl}/status`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nonce,
            digest: createHash("sha256").update(payload.payload.transaction).digest("hex"),
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
        challenges.delete(nonce);
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
