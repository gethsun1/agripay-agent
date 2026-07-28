import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { RESOURCE_REGISTRY } from "@agripay/fixtures";
import { DurableStore } from "@agripay/storage";
import { paymentPayloadSchema, paymentRequirementsSchema } from "@agripay/schemas";
import {
  settlePayment,
  recoverSettlement,
  verifyPayment,
  type HederaCredentials,
  type SettlementResult,
} from "@agripay/payments";

const MAX_BODY_BYTES = 64 * 1024;

async function readJson(request: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("request_too_large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export interface FacilitatorOptions {
  buyerAccountId: string;
  buyerPublicKey: string;
  expectedSellerAccountId: string;
  expectedPriceTinybars: bigint;
  facilitator: HederaCredentials;
  settle?: typeof settlePayment;
  store?: DurableStore;
  recover?: typeof recoverSettlement;
}

export function createFacilitatorServer(options: FacilitatorOptions): Server {
  const store = options.store ?? new DurableStore(":memory:");
  return createServer((request, response) => {
    void (async () => {
      response.setHeader("content-type", "application/json");
      if (request.method === "GET" && request.url === "/health") {
        response.end(JSON.stringify({ status: "ok" }));
        return;
      }
      if (
        request.method !== "POST" ||
        !["/verify", "/settle", "/status"].includes(request.url ?? "")
      ) {
        response.statusCode = 404;
        response.end(JSON.stringify({ error: "not_found" }));
        return;
      }
      try {
        const body = (await readJson(request)) as Record<string, unknown>;
        if (request.url === "/status") {
          const nonce = typeof body.nonce === "string" ? body.nonce : "";
          const digest = typeof body.digest === "string" ? body.digest : "";
          const settlement = store.getSettlement(nonce);
          if (!settlement || settlement.payment_digest !== digest) {
            response.statusCode = 404;
            response.end(JSON.stringify({ state: "unknown" }));
            return;
          }
          let result =
            typeof settlement.result_json === "string"
              ? (JSON.parse(settlement.result_json) as SettlementResult)
              : { state: String(settlement.state) };
          if (settlement.state === "ambiguous" && typeof settlement.transaction_id === "string") {
            result = await (options.recover ?? recoverSettlement)(settlement.transaction_id);
            store.finishSettlement(nonce, result);
          }
          response.statusCode =
            result.state === "settled" ? 200 : result.state === "failed" ? 400 : 202;
          response.end(JSON.stringify(result));
          return;
        }
        const payload = paymentPayloadSchema.parse(body.paymentPayload);
        const requirements = paymentRequirementsSchema.parse(body.paymentRequirements);
        if (
          requirements.payTo !== options.expectedSellerAccountId ||
          BigInt(requirements.maxAmountRequired) !==
            RESOURCE_REGISTRY[requirements.resource].priceTinybars ||
          requirements.extra.feePayer !== options.facilitator.accountId
        ) {
          response.statusCode = 400;
          response.end(JSON.stringify({ isValid: false, reason: "requirements_not_registered" }));
          return;
        }
        const verified = await verifyPayment(
          payload,
          requirements,
          options.buyerAccountId,
          options.buyerPublicKey,
          new Set(store.getSettlement(requirements.nonce) ? [requirements.nonce] : []),
        );
        if (request.url === "/verify") {
          response.statusCode = verified.isValid ? 200 : 400;
          response.end(
            JSON.stringify(
              verified.isValid ? { isValid: true } : { isValid: false, reason: verified.reason },
            ),
          );
          return;
        }
        if (!verified.isValid) {
          response.statusCode = 400;
          response.end(JSON.stringify({ state: "failed", reason: verified.reason }));
          return;
        }
        const requirementDigest = createHash("sha256")
          .update(JSON.stringify(requirements))
          .digest("hex");
        const paymentDigest = createHash("sha256")
          .update(payload.payload.transaction)
          .digest("hex");
        if (
          store.claimSettlement({ nonce: requirements.nonce, requirementDigest, paymentDigest }) ===
          "existing"
        ) {
          response.statusCode = 409;
          response.end(JSON.stringify({ state: "failed", reason: "settlement_in_progress" }));
          return;
        }
        const result: SettlementResult = await (options.settle ?? settlePayment)(
          verified,
          options.facilitator,
        );
        store.finishSettlement(requirements.nonce, result);
        response.statusCode =
          result.state === "settled" ? 200 : result.state === "ambiguous" ? 202 : 400;
        response.end(JSON.stringify(result));
      } catch {
        response.statusCode = 400;
        response.end(JSON.stringify({ error: "invalid_request" }));
      }
    })();
  });
}
