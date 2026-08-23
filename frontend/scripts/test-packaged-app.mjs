import { chromium } from "@playwright/test";

const cdpUrl = process.env.HFAS_CDP_URL;
if (!cdpUrl) throw new Error("HFAS_CDP_URL is required.");
const phase = process.env.HFAS_PACKAGE_PHASE ?? "initial";
const expectedVersion = process.env.HFAS_EXPECTED_VERSION;
if (!expectedVersion) throw new Error("HFAS_EXPECTED_VERSION is required.");
const storageKey = "hfas-package-uninstall-preservation-sentinel";
const storageValue = "preserve-project-profile-data";

const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 60_000 });
const pageDeadline = Date.now() + 15_000;
let page;
do {
  page = browser.contexts()
    .flatMap((candidate) => candidate.pages())
    .find((candidate) => candidate.url() !== "about:blank");
  if (!page) await new Promise((resolve) => setTimeout(resolve, 100));
} while (!page && Date.now() < pageDeadline);
if (!page) {
  const targets = browser.contexts().flatMap((candidate) => candidate.pages()).map((candidate) => candidate.url());
  throw new Error(`The packaged WebView2 runtime exposed no application page; targets: ${targets.join(", ") || "none"}.`);
}
const context = page.context();
const externalRequests = [];
page.on("request", (request) => {
  const url = new URL(request.url());
  if (["http:", "https:"].includes(url.protocol) && !["tauri.localhost", "ipc.localhost", "127.0.0.1"].includes(url.hostname)) {
    externalRequests.push(request.url());
  }
});

await page.waitForLoadState("domcontentloaded");
const changelog = page.getByRole("button", { name: "Got it" });
if (await changelog.isVisible().catch(() => false)) {
  // Native CDP input dispatch can intermittently stall in a background
  // WebView2 window even after Playwright reports the button actionable.
  // Dispatch the button's real DOM click handler, then prove the modal closed.
  await changelog.evaluate((button) => button.click());
  await changelog.waitFor({ state: "hidden", timeout: 5_000 });
}
await page.evaluate(() => {
  history.pushState({}, "", "/verified-dipole");
  dispatchEvent(new PopStateEvent("popstate"));
});
await page.getByRole("heading", { name: "Centre-fed horizontal dipole" }).waitFor({ timeout: 15_000 });

const runtime = await page.evaluate(async () => window.__TAURI__.core.invoke("get_runtime_info"));
if (!runtime.packaged || runtime.version !== expectedVersion) {
  throw new Error(`Unexpected packaged runtime identity: ${JSON.stringify(runtime)}`);
}
await page.evaluate(async (testPhase) => window.__TAURI__.core.invoke("append_diagnostic_log", {
  level: "info",
  message: `Packaged application smoke test phase: ${testPhase}`,
}), phase);

if (phase === "initial") {
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: storageKey, value: storageValue });
  await context.setOffline(true);
  await page.getByTestId("run-dipole").click();
  await page.getByTestId("dipole-results").waitFor({ timeout: 45_000 });
  const resultText = await page.getByTestId("dipole-results").innerText();
  if (!resultText.includes("Ω")) throw new Error("Packaged solver result did not contain impedance units.");
  await page.getByText("wasm-nec2c", { exact: false }).waitFor();
} else if (phase === "verify-preserved") {
  const preserved = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  if (preserved !== storageValue) throw new Error("WebView project-profile storage did not survive uninstall/reinstall.");
} else {
  throw new Error(`Unknown HFAS_PACKAGE_PHASE ${phase}`);
}
if (externalRequests.length > 0) {
  throw new Error(`Packaged calculation attempted external requests: ${externalRequests.join(", ")}`);
}

await context.setOffline(false);
console.log(`Packaged WebView2 ${phase} smoke passed; log directory: ${runtime.logDirectory}`);
await browser.close();
