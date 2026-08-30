import { expect, test } from "@playwright/test";
import { isKnownNonApplicationConsoleWarning } from "../src/test-support/browser-console";

async function dismissChangelog(page: import("@playwright/test").Page): Promise<void> {
  const button = page.getByRole("button", { name: "Got it" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

test("verified dipole executes the displayed NEC deck through local WASM", async ({ page }) => {
  const consoleProblems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      if (message.type() === "warning" && isKnownNonApplicationConsoleWarning(message.text())) return;
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.goto("/verified-dipole");
  await dismissChangelog(page);
  await expect(page.getByRole("heading", { name: "Centre-fed horizontal dipole" })).toBeVisible();
  await expect(page.getByTestId("wire-diameter")).toHaveValue("1");
  await expect(page.getByTestId("segment-count")).toHaveText("21");

  const deckBeforeRun = await page.getByTestId("generated-nec").innerText();
  expect(deckBeforeRun).toContain("GW 1 21 -5.075 0 10 5.075 0 10 0.0005");
  expect(deckBeforeRun).toContain("EX 0 1 11 0 1 0");
  expect(deckBeforeRun.trimEnd().endsWith("EN")).toBe(true);

  await page.getByTestId("run-dipole").click();
  await expect(page.getByTestId("dipole-results")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("wasm-nec2c", { exact: false })).toBeVisible();
  await expect(page.getByTestId("dipole-pattern-cuts-azimuth")).toBeVisible();
  await expect(page.getByTestId("dipole-pattern-cuts-elevation")).toBeVisible();
  await page.getByTestId("dipole-pattern-cuts-mode").click();
  await expect(page.getByTestId("elevation-angle-inspector-source-current")).toHaveText("Exact NEC sample");
  await expect(page.getByTestId("elevation-angle-inspector-gain-current")).toContainText("dB relative to cut peak");
  await expect(page.getByTestId("elevation-angle-inspector-context-current")).toHaveText("Cut peak is 0.00 dB in this view");
  const completeElevationPath = await page.getByTestId("dipole-pattern-cuts-elevation").locator('[data-testid="polar-series-elevation-current"]').getAttribute("d");
  expect(completeElevationPath).toMatch(/^M /);
  await page.getByTestId("elevation-angle-inspector-input").fill("175");
  await expect(page.getByTestId("elevation-angle-inspector-source-current")).toHaveText("Exact NEC sample");
  await expect(page.getByTestId("elevation-angle-inspector-input")).toHaveValue("175");
  const elevationPlot = page.getByTestId("dipole-pattern-cuts-elevation").getByTestId("elevation-polar-plot");
  const elevationBounds = await elevationPlot.boundingBox();
  expect(elevationBounds).not.toBeNull();
  await page.mouse.move(elevationBounds!.x + elevationBounds!.width * 0.8, elevationBounds!.y + elevationBounds!.height / 2);
  await page.mouse.down();
  const pressedAngle = Number(await page.getByTestId("elevation-angle-inspector-input").inputValue());
  await page.mouse.move(elevationBounds!.x + elevationBounds!.width * 0.2, elevationBounds!.y + elevationBounds!.height / 2, { steps: 6 });
  await expect.poll(async () => Number(await page.getByTestId("elevation-angle-inspector-input").inputValue())).toBeGreaterThan(pressedAngle + 30);
  await page.mouse.up();
  await page.getByTestId("dipole-pattern-cuts-mode").click();
  const azimuthPathBeforeCutChange = await page.getByTestId("dipole-pattern-cuts-azimuth").locator('[data-testid="polar-series-azimuth-current"]').getAttribute("d");
  await page.getByTestId("azimuth-cut-elevation-input").fill("5");
  await expect(page.getByTestId("azimuth-cut-actual-elevation")).toContainText("NEC row 5.0°");
  await expect.poll(() => page.getByTestId("dipole-pattern-cuts-azimuth").locator('[data-testid="polar-series-azimuth-current"]').getAttribute("d")).not.toBe(azimuthPathBeforeCutChange);
  const azimuthPlot = page.getByTestId("dipole-pattern-cuts-azimuth").getByTestId("azimuth-polar-plot");
  await azimuthPlot.scrollIntoViewIfNeeded();
  const azimuthBounds = await azimuthPlot.boundingBox();
  expect(azimuthBounds).not.toBeNull();
  await page.mouse.move(azimuthBounds!.x + azimuthBounds!.width / 2, azimuthBounds!.y + azimuthBounds!.height * 0.12);
  await page.mouse.down();
  await page.mouse.move(azimuthBounds!.x + azimuthBounds!.width * 0.84, azimuthBounds!.y + azimuthBounds!.height * 0.53, { steps: 8 });
  await expect.poll(async () => Number(await page.getByTestId("azimuth-bearing-inspector-input").inputValue())).toBeGreaterThan(60);
  await page.mouse.up();
  await expect(page.getByTestId("azimuth-bearing-inspector-gain-current")).toContainText("dBi");
  await expect(page.getByTestId("current-distribution")).toBeVisible();
  await expect(page.getByTestId("generated-nec")).toHaveText(deckBeforeRun);
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.getByTestId("frequency-mhz").fill("14.2");
  await expect(page.getByTestId("dipole-results")).toHaveCount(0);
  await expect(page.getByTestId("generated-nec")).toContainText("FR 0 1 0 0 14.2 0");
  expect(consoleProblems).toEqual([]);
});

test("verified dipole unit and real-ground controls preserve SI model meaning", async ({ page }) => {
  await page.goto("/verified-dipole");
  await dismissChangelog(page);
  await page.getByLabel("Total dipole length unit").selectOption("ft");
  await expect(page.getByTestId("dipole-length")).toHaveValue(/33\.3/);
  await page.getByLabel("Total dipole length unit").selectOption("m");
  await expect(page.getByTestId("dipole-length")).toHaveValue("10.15");

  await page.getByTestId("ground-kind").selectOption("real");
  await expect(page.getByTestId("ground-conductivity")).toBeVisible();
  await expect(page.getByTestId("ground-permittivity")).toBeVisible();
  await expect(page.getByTestId("generated-nec")).toContainText("GN 2 0 0 0 13 0.005");

  await page.getByRole("button", { name: "75 Ω" }).click();
  await page.getByTestId("run-dipole").click();
  await expect(page.getByTestId("dipole-results")).toContainText("SWR (75 Ω)", { timeout: 30_000 });
});
