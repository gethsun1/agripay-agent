import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DurableStore, databasePath } from "./index.js";
const [command, arg] = process.argv.slice(2);
const path = databasePath();
if (command === "migrate") {
  const store = new DurableStore(path);
  store.close();
  console.log(`Migrated database: ${path}`);
} else if (command === "backup") {
  const target = resolve(arg ?? `${path}.backup`);
  const store = new DurableStore(path);
  await store.backupTo(target);
  store.close();
  console.log(`Backup created: ${target}`);
} else if (command === "restore") {
  if (!arg) throw new Error("restore requires a backup path");
  await copyFile(resolve(arg), path);
  const store = new DurableStore(path);
  store.close();
  console.log(`Restored database: ${path}`);
} else throw new Error("Usage: cli.js migrate|backup [path]|restore <path>");
