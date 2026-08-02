import { access } from "node:fs/promises";
import { constants } from "node:fs";

const artifacts = ["public/wasm/nec2c.js", "public/wasm/nec2c.wasm"];
const missing = [];

for (const artifact of artifacts) {
  try {
    await access(new URL(`../${artifact}`, import.meta.url), constants.R_OK);
  } catch {
    missing.push(artifact);
  }
}

if (missing.length > 0) {
  throw new Error(
    `Missing NEC2C WebAssembly artifacts: ${missing.join(", ")}. ` +
      "Build them from the repository root with scripts/build-wasm.ps1 before running browser smoke tests.",
  );
}
