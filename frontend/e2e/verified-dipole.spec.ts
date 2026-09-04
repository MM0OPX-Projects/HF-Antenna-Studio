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
  expect(deckBeforeRun).toContain("LD 5 0 0 0 58000000 0 0");
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

test("global wire material changes the displayed and executed NEC conductivity", async ({ page }) => {
  await page.goto("/verified-dipole");
  await dismissChangelog(page);
  const material = page.getByLabel("Global antenna wire material");
  await expect(material).toHaveValue("copper");
  await material.selectOption("aluminum");
  await expect(page.getByTestId("generated-nec")).toContainText("LD 5 0 0 0 35400000 0 0");
  await page.getByTestId("run-dipole").click();
  await expect(page.getByTestId("dipole-results")).toBeVisible({ timeout: 30_000 });
  await material.selectOption("perfect");
  await expect(page.getByTestId("generated-nec")).not.toContainText("LD 5");
  await expect(page.getByTestId("dipole-results")).toHaveCount(0);
});

test("reviewed dipole transfer opens an exact editable Wire Editor model with result parity", async ({ page }) => {
  await page.goto("/verified-dipole");
  await dismissChangelog(page);
  await page.getByTestId("run-dipole").click();
  await expect(page.getByTestId("dipole-results")).toBeVisible({ timeout: 30_000 });
  const readNumber = async (testId: string) => Number((await page.getByTestId(testId).innerText()).replace("−", "-").match(/[+-]?\d+(?:\.\d+)?/)![0]);
  const expected = {
    resistance: await readNumber("result-resistance"),
    reactance: await readNumber("result-reactance"),
    swr: await readNumber("result-swr"),
    gain: await readNumber("result-gain"),
  };

  await page.getByTestId("open-dipole-in-editor").click();
  const review = page.getByTestId("model-transfer-review");
  await expect(review).toBeVisible();
  await expect(page.getByTestId("transfer-parity-status")).toContainText("NEC input parity passed");
  await expect(review).toContainText("1 / 21");
  await review.getByRole("button", { name: "Keep current editor model" }).click();
  await expect(page).toHaveURL(/\/verified-dipole$/);

  await page.getByTestId("open-dipole-in-editor").click();
  await page.getByTestId("confirm-model-transfer").click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByTestId("model-transfer-status")).toContainText("Exact transferred model");
  await expect(page.getByRole("heading", { name: /Antenna objects \(1 wire\)/i })).toBeVisible();
  await expect(page.locator('[data-testid="antenna-source-tree"]:visible').first()).toContainText("wire 1, segment 11");

  await page.getByRole("button", { name: "Run Simulation" }).click();
  await expect(page.getByTestId("wire-editor-simulation-status")).toHaveText("1 frequency points calculated", { timeout: 30_000 });
  const resultsText = await page.locator("#wire-editor-analysis").innerText();
  const impedance = resultsText.match(/Impedance\s+([+-]?\d+(?:\.\d+)?)\s*([+-])\s*j([+-]?\d+(?:\.\d+)?)/i);
  const swr = resultsText.match(/SWR\s+([+-]?\d+(?:\.\d+)?)/i);
  const gain = resultsText.match(/Gain\s+([+-]?\d+(?:\.\d+)?)/i);
  expect(impedance).not.toBeNull(); expect(swr).not.toBeNull(); expect(gain).not.toBeNull();
  const actualReactance = Number(impedance![3]) * (impedance![2] === "-" ? -1 : 1);
  expect(Number(impedance![1])).toBeCloseTo(expected.resistance, 1);
  expect(actualReactance).toBeCloseTo(expected.reactance, 1);
  expect(Number(swr![1])).toBeCloseTo(expected.swr, 1);
  expect(Number(gain![1])).toBeCloseTo(expected.gain, 1);

  await page.getByRole("button", { name: "Back to editor" }).click();
  await page.locator("aside").getByRole("row", { name: "Wire 1" }).first().click();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("model-transfer-status")).toContainText("Transferred model modified");
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("model-transfer-status")).toContainText("Exact transferred model");
});
