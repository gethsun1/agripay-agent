import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";

export const TASK_STATES = [
  "created",
  "planning",
  "plan_ready",
  "preflight_policy_check",
  "requesting_resource",
  "payment_required",
  "evaluating_policy",
  "policy_rejected",
  "payment_prepared",
  "verifying",
  "settling",
  "settled",
  "resource_retrying",
  "delivered",
  "partial",
  "synthesizing",
  "completed",
  "failed",
  "ambiguous",
] as const;
export type TaskState = (typeof TASK_STATES)[number];
const stateSet = new Set<string>(TASK_STATES);
const nullableText = (value: unknown): string | null =>
  value === null || value === undefined
    ? null
    : typeof value === "string"
      ? value
      : JSON.stringify(value);

const migrations = [
  `CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS tasks(
     id TEXT PRIMARY KEY, correlation_id TEXT NOT NULL UNIQUE, submission_key TEXT UNIQUE,
     question TEXT NOT NULL, state TEXT NOT NULL, plan_source TEXT, fallback_reason TEXT,
     plan_json TEXT, answer_json TEXT, estimated_tinybars TEXT NOT NULL DEFAULT '0',
     spent_tinybars TEXT NOT NULL DEFAULT '0', error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS purchases(
     task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, resource_id TEXT NOT NULL,
     rationale TEXT NOT NULL, priority INTEGER NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
     requirement_digest TEXT UNIQUE, requirement_json TEXT, payment_digest TEXT UNIQUE,
     settlement_state TEXT NOT NULL DEFAULT 'pending', transaction_id TEXT UNIQUE,
     receipt_json TEXT, delivery_state TEXT NOT NULL DEFAULT 'pending', data_json TEXT,
     amount_tinybars TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
     PRIMARY KEY(task_id, resource_id)
   );
   CREATE TABLE IF NOT EXISTS events(
     id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
     resource_id TEXT, state TEXT NOT NULL, event_type TEXT NOT NULL, detail TEXT NOT NULL,
     created_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS facilitator_settlements(
     nonce TEXT PRIMARY KEY, requirement_digest TEXT NOT NULL UNIQUE, payment_digest TEXT NOT NULL UNIQUE,
     state TEXT NOT NULL, transaction_id TEXT UNIQUE, result_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS resource_challenges(
     nonce TEXT PRIMARY KEY, requirement_digest TEXT NOT NULL UNIQUE, requirement_json TEXT NOT NULL,
     consumed_at TEXT, created_at TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id,id);
   CREATE INDEX IF NOT EXISTS idx_purchases_state ON purchases(settlement_state,delivery_state);`,
  `CREATE TABLE IF NOT EXISTS operator_sessions(
     session_hash TEXT PRIMARY KEY, csrf_hash TEXT NOT NULL, created_at TEXT NOT NULL,
     last_seen_at TEXT NOT NULL, idle_expires_at TEXT NOT NULL, absolute_expires_at TEXT NOT NULL,
     revoked_at TEXT
   );
   CREATE TABLE IF NOT EXISTS auth_attempts(
     source_hash TEXT NOT NULL, attempted_at TEXT NOT NULL, succeeded INTEGER NOT NULL DEFAULT 0
   );
   CREATE INDEX IF NOT EXISTS idx_auth_attempts_source ON auth_attempts(source_hash,attempted_at);
   CREATE TABLE IF NOT EXISTS durable_limits(
     bucket TEXT NOT NULL, subject_hash TEXT NOT NULL, window_start TEXT NOT NULL,
     count INTEGER NOT NULL, amount_tinybars TEXT NOT NULL DEFAULT '0', updated_at TEXT NOT NULL,
     PRIMARY KEY(bucket,subject_hash,window_start)
   );`,
];

export function databasePath(value = process.env.DATABASE_URL ?? "data/agripay.sqlite"): string {
  const raw = value.startsWith("file:") ? value.slice(5) : value;
  return raw === ":memory:" ? raw : resolve(raw);
}

export class DurableStore {
  readonly db: DatabaseSync;
  readonly path: string;
  constructor(path = databasePath()) {
    this.path = path;
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      chmodSync(dirname(path), 0o700);
    }
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;",
    );
    this.migrate();
  }
  migrate(): void {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    const applied = this.db.prepare("SELECT 1 FROM schema_migrations WHERE version=?");
    migrations.forEach((sql, index) => {
      const version = index + 1;
      if (applied.get(version)) return;
      this.transaction(() => {
        this.db.exec(sql);
        this.db
          .prepare("INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)")
          .run(version, new Date().toISOString());
      });
    });
  }
  transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close(): void {
    this.checkpoint();
    this.db.close();
  }
  createTask(input: {
    id: string;
    correlationId: string;
    submissionKey?: string;
    question: string;
  }): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO tasks(id,correlation_id,submission_key,question,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        input.id,
        input.correlationId,
        input.submissionKey ?? null,
        input.question,
        "created",
        now,
        now,
      );
    this.event(input.id, null, "created", "task_created", "Task created", now);
  }
  event(
    taskId: string,
    resourceId: string | null,
    state: TaskState,
    type: string,
    detail: string,
    at = new Date().toISOString(),
  ): void {
    if (!stateSet.has(state)) throw new Error("invalid_task_state");
    this.db
      .prepare(
        "INSERT INTO events(task_id,resource_id,state,event_type,detail,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(taskId, resourceId, state, type, detail, at);
    this.db.prepare("UPDATE tasks SET state=?,updated_at=? WHERE id=?").run(state, at, taskId);
  }
  updateTask(
    id: string,
    values: {
      state?: TaskState;
      planSource?: string;
      fallbackReason?: string;
      plan?: unknown;
      answer?: unknown;
      estimatedTinybars?: bigint;
      spentTinybars?: bigint;
      errorCode?: string;
    },
  ): void {
    const current = this.getTask(id);
    if (!current) throw new Error("task_not_found");
    this.db
      .prepare(
        `UPDATE tasks SET state=?,plan_source=?,fallback_reason=?,plan_json=?,answer_json=?,estimated_tinybars=?,spent_tinybars=?,error_code=?,updated_at=? WHERE id=?`,
      )
      .run(
        nullableText(values.state ?? current.state),
        nullableText(values.planSource ?? current.plan_source),
        nullableText(values.fallbackReason ?? current.fallback_reason),
        nullableText(values.plan === undefined ? current.plan_json : JSON.stringify(values.plan)),
        nullableText(
          values.answer === undefined ? current.answer_json : JSON.stringify(values.answer),
        ),
        nullableText(values.estimatedTinybars?.toString() ?? current.estimated_tinybars),
        nullableText(values.spentTinybars?.toString() ?? current.spent_tinybars),
        nullableText(values.errorCode ?? current.error_code),
        new Date().toISOString(),
        id,
      );
  }
  getTask(id: string): Record<string, unknown> | undefined {
    return this.db.prepare("SELECT * FROM tasks WHERE id=?").get(id) as
      | Record<string, unknown>
      | undefined;
  }
  getTaskBySubmissionKey(key: string): Record<string, unknown> | undefined {
    return this.db.prepare("SELECT * FROM tasks WHERE submission_key=?").get(key) as
      | Record<string, unknown>
      | undefined;
  }
  createSession(input: {
    sessionHash: string;
    csrfHash: string;
    idleExpiresAt: string;
    absoluteExpiresAt: string;
  }): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO operator_sessions(session_hash,csrf_hash,created_at,last_seen_at,idle_expires_at,absolute_expires_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        input.sessionHash,
        input.csrfHash,
        now,
        now,
        input.idleExpiresAt,
        input.absoluteExpiresAt,
      );
  }
  getSession(sessionHash: string): Record<string, unknown> | undefined {
    return this.db
      .prepare("SELECT * FROM operator_sessions WHERE session_hash=? AND revoked_at IS NULL")
      .get(sessionHash) as Record<string, unknown> | undefined;
  }
  touchSession(sessionHash: string, idleExpiresAt: string): void {
    this.db
      .prepare(
        "UPDATE operator_sessions SET last_seen_at=?,idle_expires_at=? WHERE session_hash=? AND revoked_at IS NULL",
      )
      .run(new Date().toISOString(), idleExpiresAt, sessionHash);
  }
  revokeSession(sessionHash: string): void {
    this.db
      .prepare("UPDATE operator_sessions SET revoked_at=? WHERE session_hash=?")
      .run(new Date().toISOString(), sessionHash);
  }
  recordAuthAttempt(sourceHash: string, succeeded: boolean): void {
    this.db
      .prepare("INSERT INTO auth_attempts(source_hash,attempted_at,succeeded) VALUES(?,?,?)")
      .run(sourceHash, new Date().toISOString(), succeeded ? 1 : 0);
  }
  recentFailedAuth(sourceHash: string, since: string): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) count FROM auth_attempts WHERE source_hash=? AND attempted_at>=? AND succeeded=0",
      )
      .get(sourceHash, since) as { count: number };
    return row.count;
  }
  consumeLimit(input: {
    bucket: string;
    subjectHash: string;
    windowStart: string;
    maxCount: number;
    amountTinybars?: bigint;
    maxAmountTinybars?: bigint;
  }): { allowed: boolean; count: number; amountTinybars: bigint } {
    return this.transaction(() => {
      const row = this.db
        .prepare(
          "SELECT count,amount_tinybars FROM durable_limits WHERE bucket=? AND subject_hash=? AND window_start=?",
        )
        .get(input.bucket, input.subjectHash, input.windowStart) as
        | { count: number; amount_tinybars: string }
        | undefined;
      const count = (row?.count ?? 0) + 1;
      const amount = BigInt(row?.amount_tinybars ?? "0") + (input.amountTinybars ?? 0n);
      if (
        count > input.maxCount ||
        (input.maxAmountTinybars !== undefined && amount > input.maxAmountTinybars)
      )
        return {
          allowed: false,
          count: count - 1,
          amountTinybars: BigInt(row?.amount_tinybars ?? "0"),
        };
      const now = new Date().toISOString();
      this.db
        .prepare(
          "INSERT INTO durable_limits(bucket,subject_hash,window_start,count,amount_tinybars,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(bucket,subject_hash,window_start) DO UPDATE SET count=excluded.count,amount_tinybars=excluded.amount_tinybars,updated_at=excluded.updated_at",
        )
        .run(input.bucket, input.subjectHash, input.windowStart, count, amount.toString(), now);
      return { allowed: true, count, amountTinybars: amount };
    });
  }
  countTasks(states: readonly string[]): number {
    if (!states.length) return 0;
    const marks = states.map(() => "?").join(",");
    const row = this.db
      .prepare(`SELECT COUNT(*) count FROM tasks WHERE state IN (${marks})`)
      .get(...states) as { count: number };
    return row.count;
  }
  checkpoint(): void {
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  }
  integrityCheck(): string {
    const row = this.db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    return row.integrity_check;
  }
  listEvents(id: string): Record<string, unknown>[] {
    return this.db.prepare("SELECT * FROM events WHERE task_id=? ORDER BY id").all(id) as Record<
      string,
      unknown
    >[];
  }
  addPurchase(input: {
    taskId: string;
    resourceId: string;
    rationale: string;
    priority: number;
    idempotencyKey: string;
    amountTinybars: bigint;
  }): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO purchases(task_id,resource_id,rationale,priority,idempotency_key,amount_tinybars,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        input.taskId,
        input.resourceId,
        input.rationale,
        input.priority,
        input.idempotencyKey,
        input.amountTinybars.toString(),
        now,
        now,
      );
  }
  getPurchase(taskId: string, resourceId: string): Record<string, unknown> | undefined {
    return this.db
      .prepare("SELECT * FROM purchases WHERE task_id=? AND resource_id=?")
      .get(taskId, resourceId) as Record<string, unknown> | undefined;
  }
  listPurchases(taskId: string): Record<string, unknown>[] {
    return this.db
      .prepare("SELECT * FROM purchases WHERE task_id=? ORDER BY priority,resource_id")
      .all(taskId) as Record<string, unknown>[];
  }
  listRecoverablePurchases(): Record<string, unknown>[] {
    return this.db
      .prepare(
        `SELECT * FROM purchases WHERE transaction_id IS NOT NULL AND
         (settlement_state IN ('settling','ambiguous') OR
          (settlement_state='settled' AND delivery_state!='delivered'))
         ORDER BY updated_at`,
      )
      .all() as Record<string, unknown>[];
  }
  listReceipts(input: {
    limit: number;
    offset: number;
    resourceId?: string;
    state?: string;
  }): Record<string, unknown>[] {
    const clauses = ["receipt_json IS NOT NULL"];
    const values: (string | number)[] = [];
    if (input.resourceId) {
      clauses.push("resource_id=?");
      values.push(input.resourceId);
    }
    if (input.state) {
      clauses.push("settlement_state=?");
      values.push(input.state);
    }
    values.push(input.limit, input.offset);
    return this.db
      .prepare(
        `SELECT task_id,resource_id,receipt_json,created_at,updated_at FROM purchases WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...values) as Record<string, unknown>[];
  }
  getReceipt(transactionId: string): Record<string, unknown> | undefined {
    return this.db
      .prepare(
        "SELECT task_id,resource_id,receipt_json,created_at,updated_at FROM purchases WHERE transaction_id=? AND receipt_json IS NOT NULL",
      )
      .get(transactionId) as Record<string, unknown> | undefined;
  }
  updatePurchase(
    taskId: string,
    resourceId: string,
    values: {
      requirementDigest?: string;
      requirement?: unknown;
      paymentDigest?: string;
      settlementState?: string;
      transactionId?: string;
      receipt?: unknown;
      deliveryState?: string;
      data?: unknown;
    },
  ): void {
    const p = this.getPurchase(taskId, resourceId);
    if (!p) throw new Error("purchase_not_found");
    this.db
      .prepare(
        `UPDATE purchases SET requirement_digest=?,requirement_json=?,payment_digest=?,settlement_state=?,transaction_id=?,receipt_json=?,delivery_state=?,data_json=?,updated_at=? WHERE task_id=? AND resource_id=?`,
      )
      .run(
        nullableText(values.requirementDigest ?? p.requirement_digest),
        nullableText(
          values.requirement === undefined
            ? p.requirement_json
            : JSON.stringify(values.requirement),
        ),
        nullableText(values.paymentDigest ?? p.payment_digest),
        nullableText(values.settlementState ?? p.settlement_state),
        nullableText(values.transactionId ?? p.transaction_id),
        nullableText(
          values.receipt === undefined ? p.receipt_json : JSON.stringify(values.receipt),
        ),
        nullableText(values.deliveryState ?? p.delivery_state),
        nullableText(values.data === undefined ? p.data_json : JSON.stringify(values.data)),
        new Date().toISOString(),
        taskId,
        resourceId,
      );
  }
  claimSettlement(input: {
    nonce: string;
    requirementDigest: string;
    paymentDigest: string;
  }): "claimed" | "existing" {
    return this.transaction(() => {
      const row = this.db
        .prepare(
          "SELECT * FROM facilitator_settlements WHERE nonce=? OR requirement_digest=? OR payment_digest=?",
        )
        .get(input.nonce, input.requirementDigest, input.paymentDigest);
      if (row) return "existing";
      const now = new Date().toISOString();
      this.db
        .prepare(
          "INSERT INTO facilitator_settlements(nonce,requirement_digest,payment_digest,state,created_at,updated_at) VALUES(?,?,?,?,?,?)",
        )
        .run(input.nonce, input.requirementDigest, input.paymentDigest, "settling", now, now);
      return "claimed";
    });
  }
  finishSettlement(
    nonce: string,
    result: { state: string; transactionId?: string; [key: string]: unknown },
  ): void {
    this.db
      .prepare(
        "UPDATE facilitator_settlements SET state=?,transaction_id=?,result_json=?,updated_at=? WHERE nonce=?",
      )
      .run(
        result.state,
        result.transactionId ?? null,
        JSON.stringify(result),
        new Date().toISOString(),
        nonce,
      );
  }
  getSettlement(nonce: string): Record<string, unknown> | undefined {
    return this.db.prepare("SELECT * FROM facilitator_settlements WHERE nonce=?").get(nonce) as
      | Record<string, unknown>
      | undefined;
  }
  saveChallenge(nonce: string, digest: string, requirements: unknown): void {
    this.db
      .prepare(
        "INSERT INTO resource_challenges(nonce,requirement_digest,requirement_json,created_at) VALUES(?,?,?,?)",
      )
      .run(nonce, digest, JSON.stringify(requirements), new Date().toISOString());
  }
  getChallenge(nonce: string): Record<string, unknown> | undefined {
    return this.db
      .prepare("SELECT * FROM resource_challenges WHERE nonce=? AND consumed_at IS NULL")
      .get(nonce) as Record<string, unknown> | undefined;
  }
  consumeChallenge(nonce: string): void {
    this.db
      .prepare("UPDATE resource_challenges SET consumed_at=? WHERE nonce=? AND consumed_at IS NULL")
      .run(new Date().toISOString(), nonce);
  }
  periodSpend(since: string): bigint {
    const row = this.db
      .prepare(
        "SELECT COALESCE(SUM(CAST(amount_tinybars AS INTEGER)),0) total FROM purchases WHERE settlement_state='settled' AND updated_at>=?",
      )
      .get(since) as { total: number };
    return BigInt(row.total);
  }
  async backupTo(target: string): Promise<void> {
    if (this.path === ":memory:") throw new Error("cannot_backup_memory_database");
    mkdirSync(dirname(resolve(target)), { recursive: true, mode: 0o700 });
    await backup(this.db, resolve(target));
  }
}
