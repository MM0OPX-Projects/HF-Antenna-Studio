import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const frontendDirectory = fileURLToPath(new URL("../", import.meta.url));
const e2eDirectory = fileURLToPath(new URL("../e2e/", import.meta.url));
const playwrightCli = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
const specs = (await readdir(e2eDirectory))
  .filter((entry) => entry.endsWith(".spec.ts"))
  .sort();

if (specs.length === 0) {
  throw new Error("No Playwright spec files were found.");
}

for (const [index, spec] of specs.entries()) {
  console.log(`\n=== Isolated Playwright spec ${index + 1}/${specs.length}: ${spec} ===`);
  const result = spawnSync(process.execPath, [playwrightCli, "test", `e2e/${spec}`], {
    cwd: frontendDirectory,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`\nAll ${specs.length} isolated Playwright spec files passed.`);
