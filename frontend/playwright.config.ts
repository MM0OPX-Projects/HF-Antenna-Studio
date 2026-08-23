import { defineConfig } from "@playwright/test";

const useProductionPreview = process.env.HFAS_E2E_SERVER === "preview";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: useProductionPreview
      ? "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort"
      : "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env, VITE_ENGINE: "wasm" },
  },
});
