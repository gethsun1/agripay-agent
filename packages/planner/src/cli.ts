import { readFile } from "node:fs/promises";
import { discoverModels } from "./index.js";
async function envFile(path: string): Promise<Record<string, string>> {
  try {
    return Object.fromEntries(
      (await readFile(path, "utf8"))
        .split(/\r?\n/)
        .filter((x) => x && !x.startsWith("#"))
        .map((line) => {
          const i = line.indexOf("=");
          return [line.slice(0, i), line.slice(i + 1)];
        }),
    );
  } catch {
    return {};
  }
}
if (process.argv[2] !== "models") throw new Error("Usage: cli.js models");
const local = await envFile(".env");
const apiKey = process.env.GROQ_API_KEY ?? local.GROQ_API_KEY;
const models = await discoverModels(apiKey ? { apiKey } : {});
console.log(JSON.stringify({ count: models.length, models }, null, 2));
