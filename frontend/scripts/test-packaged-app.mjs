import { chromium } from "@playwright/test";

const cdpUrl = process.env.HFAS_CDP_URL;
if (!cdpUrl) throw new Error("HFAS_CDP_URL is required.");
const phase = process.env.HFAS_PACKAGE_PHASE ?? "initial";
const expectedVersion = process.env.HFAS_EXPECTED_VERSION;
if (!expectedVersion) throw new Error("HFAS_EXPECTED_VERSION is required.");
const changelogStorageKey = "antennasim:changelog-seen";
const storageKey = "hfas-package-uninstall-preservation-sentinel";
const storageValue = "preserve-project-profile-data";

function hasExplicitRealGroundCards(deck) {
  const cards = deck
    .split(/\r?\n/)
    .map((card) => card.trim())
    .filter(Boolean);
  const geometryEnd = cards.findIndex((card) => card === "GE -1");
  return geometryEnd >= 0 && /^GN\s+2(?:\s|$)/.test(cards[geometryEnd + 1] ?? "");
}

async function connectToPackagedBrowser() {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await chromium.connectOverCDP(cdpUrl, { timeout: 60_000 });
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        console.warn("Packaged WebView2 CDP attach timed out; retrying once.");
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Packaged WebView2 CDP attach failed.");
}

const browser = await connectToPackagedBrowser();
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

async function navigateTo(path, heading) {
  await page.evaluate((nextPath) => {
    history.pushState({}, "", nextPath);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await page.getByRole("heading", { name: heading }).waitFor({ timeout: 30_000 });
}

await page.waitForLoadState("domcontentloaded");
await page.evaluate(({ key, contentId }) => {
  localStorage.setItem(key, JSON.stringify({ contentId, seenAt: Date.now() }));
}, { key: changelogStorageKey, contentId: expectedVersion });
// WebView2 can commit the custom tauri.localhost navigation without forwarding a
// DOMContentLoaded lifecycle event through CDP.  Resolve on the committed
// navigation, then prove that React has hydrated before interacting with it.
await page.reload({ waitUntil: "commit", timeout: 30_000 });
await page.getByRole("link", { name: /^HF Antenna Studio/ }).waitFor({
  state: "visible",
  timeout: 120_000,
});
const changelog = page.getByRole("button", { name: "Got it" });
await changelog.waitFor({ state: "hidden", timeout: 15_000 });
await navigateTo("/verified-dipole", "Centre-fed horizontal dipole");

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

  await navigateTo("/vertical-antennas", "Vertical antennas");
  await page.getByTestId("vertical-mode-ground-mounted-explicit-radials").click();
  await page.getByTestId("run-vertical-nec").click();
  await page.getByTestId("vertical-results").waitFor({ timeout: 60_000 });
  const verticalDeck = await page.getByTestId("vertical-generated-nec").textContent() ?? "";
  if (!hasExplicitRealGroundCards(verticalDeck)) throw new Error("Packaged ground-mounted vertical did not use the explicit real-ground radial deck.");
  await page.getByTestId("radial-current-path").waitFor({ timeout: 15_000 });

  await navigateTo("/phased-arrays", "Two-element phased vertical arrays");
  await page.getByTestId("phased-radial-mode").selectOption("near-surface-explicit-wires");
  await page.getByTestId("phased-generated-nec")
    .filter({ hasText: "topology: shared-bonded-network" })
    .filter({ hasText: /GE -1\r?\nGN 2/ })
    .waitFor({ timeout: 30_000 });
  await page.getByTestId("phased-results").waitFor({ timeout: 120_000 });
  const phasedDeck = await page.getByTestId("phased-generated-nec").textContent() ?? "";
  if (!phasedDeck.includes("topology: shared-bonded-network") || !hasExplicitRealGroundCards(phasedDeck)) {
    throw new Error("Packaged phased array did not use the explicit shared real-ground radial deck.");
  }
  await page.getByTestId("phased-current-visualisation").waitFor({ timeout: 15_000 });

  await page.evaluate(() => {
    history.pushState({}, "", "/");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.getByRole("button", { name: /Run( Simulation)?/ }).first().waitFor({ timeout: 15_000 });
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
