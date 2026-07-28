import { execFileSync } from "node:child_process";

const output = execFileSync("pnpm", ["licenses", "list", "--json"], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
const licenses = JSON.parse(output);
const forbidden = Object.keys(licenses).filter((name) => /(?:^|-)A?GPL-(?:2|3)/i.test(name));
if (forbidden.length) throw new Error(`Forbidden production licenses: ${forbidden.join(", ")}`);
process.stdout.write(
  `License policy passed (${String(Object.keys(licenses).length)} license groups).\n`,
);
