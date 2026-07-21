import { z } from "zod";
const configuredBase: unknown = (import.meta.env as unknown as Record<string, unknown>)
  .VITE_API_URL;
const base = typeof configuredBase === "string" ? configuredBase : "";
const errorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  correlationId: z.string().optional(),
});
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/json");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => ({ error: "invalid_response" }))) as unknown;
  if (!response.ok) {
    const parsed = errorSchema.safeParse(body);
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.error : "request_failed",
      parsed.success ? (parsed.data.message ?? parsed.data.error) : "Request failed",
    );
  }
  return schema.parse(body);
}
export const taskSchema = z
  .object({
    id: z.string(),
    correlation_id: z.string(),
    question: z.string(),
    state: z.string(),
    plan_source: z.string().nullable(),
    fallback_reason: z.string().nullable(),
    plan_json: z.string().nullable(),
    answer_json: z.string().nullable(),
    estimated_tinybars: z.string(),
    spent_tinybars: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    purchases: z.array(z.record(z.unknown())).optional(),
  })
  .passthrough();
export const eventSchema = z.object({
  id: z.number(),
  task_id: z.string(),
  resource_id: z.string().nullable(),
  state: z.string(),
  event_type: z.string(),
  detail: z.string(),
  created_at: z.string(),
});
export type Task = z.infer<typeof taskSchema>;
export type TaskEvent = z.infer<typeof eventSchema>;
export const api = {
  createTask: (question: string, submissionKey: string, confirmed: boolean) =>
    request(
      "/api/agent/tasks",
      z.object({ taskId: z.string(), correlationId: z.string(), state: z.string() }),
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": submissionKey },
        body: JSON.stringify({ question, submissionKey, confirmed, maxSpendTinybars: "16000000" }),
      },
    ),
  task: (id: string) => request(`/api/agent/tasks/${encodeURIComponent(id)}`, taskSchema),
  events: (id: string) =>
    request(`/api/agent/tasks/${encodeURIComponent(id)}/events`, z.array(eventSchema)),
  receipts: (id: string) =>
    request(`/api/agent/tasks/${encodeURIComponent(id)}/receipts`, z.array(z.record(z.unknown()))),
  health: () => request("/health", z.object({ status: z.string() })),
  policy: () => request("/api/policies/public", z.record(z.unknown())),
};
export const terminalStates = new Set(["completed", "partial", "failed", "policy_rejected"]);
export function mergeEvents(current: TaskEvent[], incoming: TaskEvent[]) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
