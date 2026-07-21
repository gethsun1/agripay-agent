import { taskPlanSchema, type ResourceId, type TaskPlan } from "@agripay/schemas";

export type FallbackReason =
  | "groq_timeout"
  | "groq_rate_limited"
  | "authentication_error"
  | "invalid_structured_output"
  | "model_unavailable"
  | "missing_configuration";
export interface PlanningResult {
  plan: TaskPlan;
  planSource: "groq" | "deterministic-fallback";
  model?: string;
  fallbackReason?: FallbackReason;
}
export interface GroqOptions {
  apiKey?: string;
  model?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  baseUrl?: string;
}
const forbidden =
  /(https?:\/\/|0\.0\.\d+|private.?key|api.?key|authorization|tinybar|hbar|seller|recipient|asset|network)/i;
const allowed = new Set<ResourceId>(["weather-risk", "disease-risk", "market-intelligence"]);

export function normalizePlan(value: unknown): TaskPlan {
  const serialized = JSON.stringify(value);
  if (forbidden.test(serialized)) throw new Error("planner_output_contains_authority_fields");
  const parsed = taskPlanSchema.parse(value);
  const seen = new Set<ResourceId>();
  const resources = parsed.resources
    .filter((item) => {
      if (!allowed.has(item.resourceId) || seen.has(item.resourceId)) return false;
      seen.add(item.resourceId);
      return true;
    })
    .sort((a, b) => a.priority - b.priority || a.resourceId.localeCompare(b.resourceId));
  if (!resources.length) throw new Error("unsupported_resources");
  const norm = (s: string) => s.trim().toLowerCase();
  return {
    ...parsed,
    location: {
      county: norm(parsed.location.county) === "nandi" ? "Nandi" : parsed.location.county.trim(),
    },
    ...(parsed.crop ? { crop: norm(parsed.crop) === "maize" ? "maize" : norm(parsed.crop) } : {}),
    ...(parsed.commodity
      ? { commodity: norm(parsed.commodity) === "maize" ? "maize" : norm(parsed.commodity) }
      : {}),
    resources,
  };
}

export function deterministicPlan(question: string): TaskPlan {
  const q = question.toLowerCase();
  const selected: ResourceId[] = [];
  if (/weather|rain|plant|soil|temperature/.test(q)) selected.push("weather-risk");
  if (/disease|pest|scout|leaf|blight/.test(q)) selected.push("disease-risk");
  if (/market|price|demand|sell|buyer|supply/.test(q)) selected.push("market-intelligence");
  if (!selected.length) selected.push("weather-risk");
  return {
    intent: "agricultural decision support",
    location: { county: /nandi/i.test(question) ? "Nandi" : "Nandi" },
    crop: "maize",
    commodity: "maize",
    requestedOutcome: question.slice(0, 240),
    resources: selected.map((resourceId, index) => ({
      resourceId,
      priority: index + 1,
      reason: `Question matched the registered ${resourceId} capability`,
    })),
  };
}

function reasonFor(error: unknown): FallbackReason {
  if (error instanceof DOMException && error.name === "TimeoutError") return "groq_timeout";
  const message = error instanceof Error ? error.message : "";
  if (message.includes("429")) return "groq_rate_limited";
  if (message.includes("401") || message.includes("403")) return "authentication_error";
  if (message.includes("404") || message.includes("model")) return "model_unavailable";
  return "invalid_structured_output";
}
export async function planQuestion(
  question: string,
  options: GroqOptions = {},
): Promise<PlanningResult> {
  if (!options.apiKey || !options.model)
    return {
      plan: deterministicPlan(question),
      planSource: "deterministic-fallback",
      fallbackReason: "missing_configuration",
    };
  try {
    const response = await (options.fetch ?? fetch)(
      `${options.baseUrl ?? "https://api.groq.com/openai/v1"}/chat/completions`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
        body: JSON.stringify({
          model: options.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Return strict JSON only: intent, location:{county}, optional crop, optional commodity, requestedOutcome, resources:[{resourceId (weather-risk|disease-risk|market-intelligence), reason, priority 1..3}]. Never return URLs, accounts, networks, assets, prices, payment instructions, or secrets.",
            },
            { role: "user", content: question.slice(0, 1000) },
          ],
        }),
      },
    );
    if (!response.ok) throw new Error(`groq_http_${String(response.status)}`);
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("invalid_structured_output");
    return {
      plan: normalizePlan(JSON.parse(content) as unknown),
      planSource: "groq",
      model: options.model,
    };
  } catch (error) {
    return {
      plan: deterministicPlan(question),
      planSource: "deterministic-fallback",
      fallbackReason: reasonFor(error),
    };
  }
}
export async function discoverModels(
  options: GroqOptions = {},
): Promise<{ id: string; ownedBy?: string; active?: boolean }[]> {
  if (!options.apiKey) throw new Error("missing_configuration");
  const response = await (options.fetch ?? fetch)(
    `${options.baseUrl ?? "https://api.groq.com/openai/v1"}/models`,
    {
      headers: { authorization: `Bearer ${options.apiKey}` },
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "groq_rate_limited"
        : response.status === 401
          ? "authentication_error"
          : `groq_http_${String(response.status)}`,
    );
  const body = (await response.json()) as {
    data?: { id?: string; owned_by?: string; active?: boolean }[];
  };
  return (body.data ?? [])
    .filter(
      (m): m is { id: string; owned_by?: string; active?: boolean } => typeof m.id === "string",
    )
    .map((m) => ({
      id: m.id,
      ...(m.owned_by ? { ownedBy: m.owned_by } : {}),
      ...(typeof m.active === "boolean" ? { active: m.active } : {}),
    }));
}

export async function synthesize(
  question: string,
  delivered: unknown[],
  options: GroqOptions = {},
): Promise<{ source: "groq" | "deterministic-fallback"; answer: Record<string, unknown> }> {
  const fallback = {
    executiveRecommendation:
      "Use the validated demonstration evidence below and verify against live local observations before acting.",
    assessments: delivered,
    nextActions: [
      "Confirm conditions locally",
      "Compare current buyer quotes",
      "Seek qualified agronomic advice where needed",
    ],
    uncertainties: ["All purchased outputs are curated demonstration fixtures"],
    disclaimer: "Demonstration data only; not professional advice.",
  };
  if (!options.apiKey || !options.model)
    return { source: "deterministic-fallback", answer: fallback };
  try {
    const response = await (options.fetch ?? fetch)(
      `${options.baseUrl ?? "https://api.groq.com/openai/v1"}/chat/completions`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
        body: JSON.stringify({
          model: options.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Create concise JSON agricultural decision brief with executiveRecommendation, weatherAssessment, diseaseAssessment, marketAssessment, nextActions, uncertainties, disclaimer. Use only supplied validated data; state missing sections, never invent.",
            },
            {
              role: "user",
              content: JSON.stringify({
                question: question.slice(0, 1000),
                delivered,
                disclaimer: "Curated demonstration data only",
              }),
            },
          ],
        }),
      },
    );
    if (!response.ok) throw new Error("synthesis_failed");
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("synthesis_failed");
    return { source: "groq", answer: JSON.parse(content) as Record<string, unknown> };
  } catch {
    return { source: "deterministic-fallback", answer: fallback };
  }
}
