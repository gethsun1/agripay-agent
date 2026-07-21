import { createHash, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { runTask, type TaskOptions } from "@agripay/agent";
import { RESOURCE_REGISTRY } from "@agripay/fixtures";
import { DurableStore } from "@agripay/storage";

const MAX_BODY = 4096;
async function jsonBody(stream: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const b = Buffer.from(chunk as Uint8Array);
    size += b.length;
    if (size > MAX_BODY) throw new Error("request_too_large");
    chunks.push(b);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
export type AgentApiOptions = Omit<TaskOptions, "question" | "submissionKey"> & {
  store: DurableStore;
};
export function createAgentApiServer(options: AgentApiOptions): Server {
  const recent: number[] = [];
  return createServer((request, response) => {
    void (async () => {
      response.setHeader("content-type", "application/json");
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/health") {
        response.end(JSON.stringify({ status: "ok" }));
        return;
      }
      if (request.method === "GET" && url.pathname === "/ready") {
        response.end(JSON.stringify({ status: "ready", database: true }));
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/network/status") {
        response.end(JSON.stringify({ network: "hedera-testnet", mainnetAllowed: false }));
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/resources/catalogue") {
        response.end(
          JSON.stringify(
            Object.values(RESOURCE_REGISTRY).map((r) => ({
              id: r.id,
              path: r.path,
              priceTinybars: r.priceTinybars.toString(),
              description: r.description,
              network: "hedera-testnet",
              asset: "HBAR",
            })),
          ),
        );
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/policies/public") {
        response.end(
          JSON.stringify({
            network: "hedera-testnet",
            asset: "HBAR",
            allowlistedResources: Object.keys(RESOURCE_REGISTRY),
            maxResourceTinybars: options.maxResourceTinybars.toString(),
            maxTaskTinybars: options.maxTaskTinybars.toString(),
            maxPeriodTinybars: options.maxPeriodTinybars.toString(),
            maxPaymentsPerTask: options.maxPaymentsPerTask ?? 3,
            changedPrice: "refuse",
          }),
        );
        return;
      }
      const match = /^\/api\/agent\/tasks\/([^/]+)(?:\/(events|receipts))?$/.exec(url.pathname);
      if (request.method === "GET" && match?.[1]) {
        const task = options.store.getTask(match[1]);
        if (!task) {
          response.statusCode = 404;
          response.end(JSON.stringify({ error: "not_found" }));
          return;
        }
        response.end(
          JSON.stringify(
            match[2] === "events"
              ? options.store.listEvents(match[1])
              : match[2] === "receipts"
                ? options.store
                    .listPurchases(match[1])
                    .filter((p) => p.receipt_json)
                    .map(
                      (p): unknown =>
                        JSON.parse(
                          typeof p.receipt_json === "string" ? p.receipt_json : "null",
                        ) as unknown,
                    )
                : { ...task, purchases: options.store.listPurchases(match[1]) },
          ),
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/agent/tasks") {
        const now = Date.now();
        while (recent[0] !== undefined && recent[0] < now - 60_000) recent.shift();
        if (recent.length >= 10) {
          response.statusCode = 429;
          response.end(JSON.stringify({ error: "rate_limited" }));
          return;
        }
        recent.push(now);
        const body = (await jsonBody(request)) as { question?: unknown; submissionKey?: unknown };
        if (
          typeof body.question !== "string" ||
          body.question.trim().length < 3 ||
          body.question.length > 1000
        ) {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: "invalid_question" }));
          return;
        }
        if (/https?:\/\//i.test(body.question)) {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: "arbitrary_url_refused" }));
          return;
        }
        const submissionKey =
          typeof body.submissionKey === "string" && body.submissionKey.length <= 128
            ? body.submissionKey
            : createHash("sha256").update(body.question).digest("hex");
        const taskId = randomUUID(),
          correlationId = randomUUID();
        const work = runTask({
          ...options,
          question: body.question,
          submissionKey,
          taskId,
          correlationId,
        });
        response.statusCode = 202;
        response.end(JSON.stringify({ taskId, correlationId, state: "created" }));
        void work.catch((error: unknown) => {
          void error;
        });
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ error: "not_found" }));
    })().catch(() => {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: "invalid_request" }));
    });
  });
}
