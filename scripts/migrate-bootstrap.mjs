import { chmod, rename, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const path = ".env";
const source = await import("node:fs/promises").then(({ readFile }) => readFile(path, "utf8"));
if (/^HEDERA_BOOTSTRAP_(ACCOUNT_ID|PRIVATE_KEY)=/m.test(source)) process.exit(0);
if (!/^HEDERA_BUYER_ACCOUNT_ID=.+/m.test(source) || !/^HEDERA_BUYER_PRIVATE_KEY=.+/m.test(source)) {
  throw new Error("Bootstrap migration requires populated buyer account fields");
}
const migrated = source
  .replace(/^HEDERA_BUYER_ACCOUNT_ID=/m, "HEDERA_BOOTSTRAP_ACCOUNT_ID=")
  .replace(/^HEDERA_BUYER_PRIVATE_KEY=/m, "HEDERA_BOOTSTRAP_PRIVATE_KEY=");
const temporary = `.env.${randomUUID()}.tmp`;
const current = await stat(path);
await writeFile(temporary, migrated, { mode: 0o600, flag: "wx" });
await chmod(temporary, current.mode & 0o777);
await rename(temporary, path);
