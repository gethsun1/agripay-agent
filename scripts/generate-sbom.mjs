import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const roots = JSON.parse(
  execFileSync("pnpm", ["list", "--json", "--depth", "Infinity"], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  }),
);
const components = new Map();
const visit = (node) => {
  if (node.name && node.version)
    components.set(`${node.name}@${node.version}`, {
      type: "library",
      name: node.name,
      version: node.version,
      "bom-ref": `pkg:npm/${encodeURIComponent(node.name)}@${node.version}`,
    });
  for (const group of [node.dependencies, node.devDependencies, node.optionalDependencies])
    for (const child of Object.values(group ?? {})) visit(child);
};
for (const root of roots) visit(root);
mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/sbom.cdx.json",
  `${JSON.stringify({ bomFormat: "CycloneDX", specVersion: "1.5", version: 1, metadata: { timestamp: new Date().toISOString(), component: { type: "application", name: "agripay-agent" } }, components: [...components.values()] }, null, 2)}\n`,
  { mode: 0o600 },
);
