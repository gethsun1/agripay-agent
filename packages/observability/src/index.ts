import { createHash } from "node:crypto";
const sensitive =
  /(authorization|cookie|csrf|password|passphrase|secret|private.?key|api.?key|signed.?payload|transaction)$/i;
const privateShape =
  /(?:302e020100300506032b657004220420|3030020100300706052b8104000a04220420)[0-9a-f]{64}/gi;
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[MAX_DEPTH]";
  if (typeof value === "string") return value.replace(privateShape, "[REDACTED_KEY]");
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitive.test(key) ? "[REDACTED]" : redact(item, depth + 1),
      ]),
    );
  return value;
}
export function questionFingerprint(question: string): { hash: string; length: number } {
  return {
    hash: createHash("sha256").update(question).digest("hex").slice(0, 16),
    length: question.length,
  };
}
export interface LogEvent {
  level: "debug" | "info" | "warn" | "error";
  event: string;
  correlationId?: string;
  taskId?: string;
  resourceId?: string;
  durationMs?: number;
  status?: string;
  errorCode?: string;
  [key: string]: unknown;
}
export class Logger {
  constructor(
    readonly service: string,
    readonly environment: string,
    readonly json = environment === "production",
  ) {}
  log(event: LogEvent): void {
    const safe = redact({
      timestamp: new Date().toISOString(),
      service: this.service,
      environment: this.environment,
      ...event,
    });
    if (this.json) process.stdout.write(`${JSON.stringify(safe)}\n`);
    else {
      const row = safe as Record<string, unknown>;
      process.stdout.write(
        `${String(row.timestamp)} ${event.level.toUpperCase()} ${this.service} ${event.event}${event.status ? ` status=${event.status}` : ""}${event.errorCode ? ` error=${event.errorCode}` : ""}\n`,
      );
    }
  }
}
