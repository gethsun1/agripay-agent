import { access, copyFile, rename, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { DurableStore, databasePath } from "./index.js";
const [command, arg, confirmation] = process.argv.slice(2),
  path = databasePath();
const explicit = (value: string | undefined) => {
  if (!value) throw new Error("An explicit file path is required");
  const result = resolve(value);
  if (result === "/" || result === resolve(".")) throw new Error("Unsafe path refused");
  return result;
};
if (command === "migrate") {
  const store = new DurableStore(path);
  store.close();
  console.log(`Migrated database: ${path}`);
} else if (command === "check") {
  const store = new DurableStore(path);
  const result = store.integrityCheck();
  store.close();
  if (result !== "ok") throw new Error("Database integrity check failed");
  console.log("Database integrity: ok");
} else if (command === "backup") {
  const target = explicit(arg);
  const store = new DurableStore(path);
  await store.backupTo(target);
  store.close();
  const check = new DurableStore(target);
  if (check.integrityCheck() !== "ok") throw new Error("Backup verification failed");
  check.close();
  console.log(`Verified backup created: ${target}`);
} else if (command === "verify-backup") {
  const backup = explicit(arg);
  await access(backup, constants.R_OK);
  const check = new DurableStore(backup);
  if (check.integrityCheck() !== "ok") throw new Error("Backup verification failed");
  check.close();
  console.log("Backup integrity: ok");
} else if (command === "restore") {
  const backup = explicit(arg);
  if (confirmation !== "--confirm-offline-restore")
    throw new Error("Restore requires --confirm-offline-restore and service downtime");
  await access(backup, constants.R_OK);
  const check = new DurableStore(backup);
  if (check.integrityCheck() !== "ok") throw new Error("Backup integrity check failed");
  check.close();
  try {
    await stat(path);
    await copyFile(path, `${path}.pre-restore`);
  } catch {
    // A pre-restore copy is only possible when the target database already exists.
  }
  const temporary = `${path}.restore-tmp`;
  await copyFile(backup, temporary);
  await rename(temporary, path);
  const restored = new DurableStore(path);
  if (restored.integrityCheck() !== "ok")
    throw new Error("Restored database integrity check failed");
  restored.close();
  console.log(`Restored database with pre-restore backup: ${path}`);
} else
  throw new Error(
    "Usage: cli.js migrate|check|backup <path>|verify-backup <path>|restore <path> --confirm-offline-restore",
  );
