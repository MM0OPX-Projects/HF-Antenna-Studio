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
  await expect(page.getByTestId("azimuth-pattern")).toBeVisible();
  await expect(page.getByTestId("elevation-pattern")).toBeVisible();
  await expect(page.getByTestId("elevation-angle-inspector-source-dipole")).toHaveText("Exact NEC sample");
  await expect(page.getByTestId("elevation-angle-inspector-gain-dipole")).toContainText("dB below cut peak");
  await expect(page.getByTestId("elevation-angle-inspector-context-dipole")).toContainText("dBi absolute");
  await expect(page.getByTestId("elevation-angle-inspector-context-dipole")).toContainText("cut peak");
  await page.getByTestId("elevation-angle-inspector-input").fill("175");
  await expect(page.getByTestId("elevation-angle-inspector-source-dipole")).toHaveText("Exact NEC sample");
  await expect(page.getByTestId("elevation-angle-inspector-input")).toHaveValue("175");
  const elevationPlot = page.getByTestId("elevation-pattern").locator("svg").first();
  const elevationBounds = await elevationPlot.boundingBox();
  expect(elevationBounds).not.toBeNull();
  await page.mouse.move(elevationBounds!.x + elevationBounds!.width * 0.2, elevationBounds!.y + elevationBounds!.height / 2);
  await page.mouse.down();
  const pressedAngle = Number(await page.getByTestId("elevation-angle-inspector-input").inputValue());
  await page.mouse.move(elevationBounds!.x + elevationBounds!.width * 0.8, elevationBounds!.y + elevationBounds!.height / 2, { steps: 6 });
  await expect.poll(async () => Number(await page.getByTestId("elevation-angle-inspector-input").inputValue())).toBeGreaterThan(pressedAngle + 30);
  await page.mouse.up();
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
