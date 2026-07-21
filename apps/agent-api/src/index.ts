import { randomUUID } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";
import { runTask, type TaskOptions } from "@agripay/agent";
import { RESOURCE_REGISTRY } from "@agripay/fixtures";
import { resourceIdSchema } from "@agripay/schemas";
import { DurableStore } from "@agripay/storage";
import { z } from "zod";

const MAX_BODY = 4096;
const taskRequestSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(10)
      .max(1000)
      .refine((v) => !httpsPattern.test(v), "URLs are not accepted"),
    submissionKey: z.string().min(8).max(128),
    confirmed: z.boolean().default(false),
    maxSpendTinybars: z.literal("16000000").optional(),
  })
  .strict();
const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  resource: z.string().optional(),
  state: z.enum(["settled", "failed", "ambiguous"]).optional(),
});
const httpsPattern = /https?:\/\//i;
async function jsonBody(stream: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error("request_too_large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
function send(
  response: ServerResponse,
  status: number,
  body: unknown,
  correlationId: string,
): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.setHeader("x-correlation-id", correlationId);
  response.end(JSON.stringify(body));
}
function receipt(row: Record<string, unknown>): unknown {
  return typeof row.receipt_json === "string" ? (JSON.parse(row.receipt_json) as unknown) : null;
}
export type AgentApiOptions = Omit<TaskOptions, "question" | "submissionKey"> & {
  store: DurableStore;
  mode?: "mock" | "hedera-testnet";
  allowedOrigins?: readonly string[];
};
export function createAgentApiServer(options: AgentApiOptions): Server {
  const recent: number[] = [];
  const allowed = new Set(
    options.allowedOrigins ?? ["http://localhost:3000", "http://127.0.0.1:3000"],
  );
  return createServer((request, response) => {
    const correlationId =
      typeof request.headers["x-correlation-id"] === "string"
        ? request.headers["x-correlation-id"]
        : randomUUID();
    void (async () => {
      const origin = request.headers.origin;
      if (origin && allowed.has(origin)) {
        response.setHeader("access-control-allow-origin", origin);
        response.setHeader("vary", "origin");
        response.setHeader(
          "access-control-allow-headers",
          "content-type,idempotency-key,x-correlation-id",
        );
        response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
      }
      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.end();
        return;
      }
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/health") {
        send(response, 200, { status: "ok" }, correlationId);
        return;
      }
      if (request.method === "GET" && url.pathname === "/ready") {
        send(response, 200, { status: "ready", database: true }, correlationId);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/network/status") {
        send(
          response,
          200,
          {
            network: "hedera-testnet",
            mode: options.mode ?? "mock",
            mainnetAllowed: false,
            buyerAccountId: options.buyer.accountId,
            sellerAccountId: options.sellerAccountId,
            facilitatorAccountId: options.facilitatorAccountId,
          },
          correlationId,
        );
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/resources/catalogue") {
        send(
          response,
          200,
          Object.values(RESOURCE_REGISTRY).map((r) => ({
            id: r.id,
            path: r.path,
            priceTinybars: r.priceTinybars.toString(),
            description: r.description,
            network: "hedera-testnet",
            asset: "HBAR",
            sellerAccountId: options.sellerAccountId,
          })),
          correlationId,
        );
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/policies/public") {
        send(
          response,
          200,
          {
            network: "hedera-testnet",
            asset: "HBAR",
            allowlistedResources: Object.keys(RESOURCE_REGISTRY),
            sellerAccountId: options.sellerAccountId,
            maxResourceTinybars: options.maxResourceTinybars.toString(),
            maxTaskTinybars: options.maxTaskTinybars.toString(),
            maxPeriodTinybars: options.maxPeriodTinybars.toString(),
            maxPaymentsPerTask: options.maxPaymentsPerTask ?? 3,
            changedPrice: "refuse",
            replayProtection: "durable",
          },
          correlationId,
        );
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/receipts") {
        const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
          send(
            response,
            400,
            { error: "invalid_query", message: "Receipt filters are invalid", correlationId },
            correlationId,
          );
          return;
        }
        const resourceId = parsed.data.resource
          ? resourceIdSchema.safeParse(parsed.data.resource)
          : undefined;
        if (resourceId && !resourceId.success) {
          send(
            response,
            400,
            {
              error: "invalid_resource",
              message: "Resource filter is not registered",
              correlationId,
            },
            correlationId,
          );
          return;
        }
        const rows = options.store.listReceipts({
          limit: parsed.data.limit,
          offset: parsed.data.offset,
          ...(resourceId?.success ? { resourceId: resourceId.data } : {}),
          ...(parsed.data.state ? { state: parsed.data.state } : {}),
        });
        send(
          response,
          200,
          {
            items: rows.map(receipt).filter(Boolean),
            limit: parsed.data.limit,
            offset: parsed.data.offset,
          },
          correlationId,
        );
        return;
      }
      const receiptMatch = /^\/api\/receipts\/(.+)$/.exec(url.pathname);
      if (request.method === "GET" && receiptMatch?.[1]) {
        const row = options.store.getReceipt(decodeURIComponent(receiptMatch[1]));
        if (!row) {
          send(
            response,
            404,
            { error: "not_found", message: "Receipt not found", correlationId },
            correlationId,
          );
          return;
        }
        send(response, 200, receipt(row), correlationId);
        return;
      }
      const taskMatch = /^\/api\/agent\/tasks\/([^/]+)(?:\/(events|receipts))?$/.exec(url.pathname);
      if (request.method === "GET" && taskMatch?.[1]) {
        const task = options.store.getTask(taskMatch[1]);
        if (!task) {
          send(
            response,
            404,
            { error: "not_found", message: "Task not found", correlationId },
            correlationId,
          );
          return;
        }
        const body =
          taskMatch[2] === "events"
            ? options.store.listEvents(taskMatch[1])
            : taskMatch[2] === "receipts"
              ? options.store.listPurchases(taskMatch[1]).map(receipt).filter(Boolean)
              : { ...task, purchases: options.store.listPurchases(taskMatch[1]) };
        send(response, 200, body, correlationId);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/agent/tasks") {
        const now = Date.now();
        while (recent[0] !== undefined && recent[0] < now - 60_000) recent.shift();
        if (recent.length >= 10) {
          send(
            response,
            429,
            { error: "rate_limited", message: "Task creation limit reached", correlationId },
            correlationId,
          );
          return;
        }
        const parsed = taskRequestSchema.safeParse(await jsonBody(request));
        if (!parsed.success) {
          send(
            response,
            400,
            {
              error: "invalid_request",
              message: "Question, idempotency key, or confirmation is invalid",
              correlationId,
            },
            correlationId,
          );
          return;
        }
        const headerKey = request.headers["idempotency-key"];
        if (typeof headerKey === "string" && headerKey !== parsed.data.submissionKey) {
          send(
            response,
            400,
            {
              error: "idempotency_mismatch",
              message: "Idempotency keys do not match",
              correlationId,
            },
            correlationId,
          );
          return;
        }
        const existing = options.store.getTaskBySubmissionKey(parsed.data.submissionKey);
        if (existing) {
          send(
            response,
            200,
            {
              taskId: existing.id,
              correlationId: existing.correlation_id,
              state: existing.state,
              reused: true,
            },
            correlationId,
          );
          return;
        }
        if (
          (options.mode ?? "mock") === "hedera-testnet" &&
          (!parsed.data.confirmed || parsed.data.maxSpendTinybars !== "16000000")
        ) {
          send(
            response,
            409,
            {
              error: "live_confirmation_required",
              message: "Explicit confirmation of the exact 16000000 tinybar maximum is required",
              correlationId,
            },
            correlationId,
          );
          return;
        }
        recent.push(now);
        const taskId = randomUUID();
        const work = runTask({
          ...options,
          question: parsed.data.question,
          submissionKey: parsed.data.submissionKey,
          taskId,
          correlationId,
        });
        send(
          response,
          202,
          { taskId, correlationId, state: "created", reused: false },
          correlationId,
        );
        void work.catch(() => undefined);
        return;
      }
      send(
        response,
        404,
        { error: "not_found", message: "Route not found", correlationId },
        correlationId,
      );
    })().catch((error: unknown) => {
      const code = error instanceof Error && error.message === "request_too_large" ? 413 : 400;
      send(
        response,
        code,
        {
          error: code === 413 ? "request_too_large" : "invalid_request",
          message: "Request could not be processed",
          correlationId,
        },
        correlationId,
      );
    });
  });
}
