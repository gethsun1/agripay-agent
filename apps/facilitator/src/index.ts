import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { paymentPayloadSchema, paymentRequirementsSchema } from "@agripay/schemas";
import {
  settlePayment,
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
}

export function createFacilitatorServer(options: FacilitatorOptions): Server {
  const usedNonces = new Set<string>();
  const settlingNonces = new Set<string>();
  const settlements = new Map<string, { result: SettlementResult; digest: string }>();
  return createServer((request, response) => {
    void (async () => {
      response.setHeader("content-type", "application/json");
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
          const settlement = settlements.get(nonce);
          if (!settlement || settlement.digest !== digest) {
            response.statusCode = 404;
            response.end(JSON.stringify({ state: "unknown" }));
            return;
          }
          response.statusCode = settlement.result.state === "settled" ? 200 : 202;
          response.end(JSON.stringify(settlement.result));
          return;
        }
        const payload = paymentPayloadSchema.parse(body.paymentPayload);
        const requirements = paymentRequirementsSchema.parse(body.paymentRequirements);
        if (
          requirements.payTo !== options.expectedSellerAccountId ||
          BigInt(requirements.maxAmountRequired) !== options.expectedPriceTinybars ||
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
          usedNonces,
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
        if (settlingNonces.has(requirements.nonce)) {
          response.statusCode = 409;
          response.end(JSON.stringify({ state: "failed", reason: "settlement_in_progress" }));
          return;
        }
        settlingNonces.add(requirements.nonce);
        const result: SettlementResult = await (options.settle ?? settlePayment)(
          verified,
          options.facilitator,
        );
        if (result.state === "settled" || result.state === "ambiguous") {
          usedNonces.add(requirements.nonce);
          settlements.set(requirements.nonce, {
            result,
            digest: createHash("sha256").update(payload.payload.transaction).digest("hex"),
          });
        } else {
          settlingNonces.delete(requirements.nonce);
        }
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
