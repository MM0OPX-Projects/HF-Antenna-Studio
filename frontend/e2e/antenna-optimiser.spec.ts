import { expect, test, type Page } from "@playwright/test";

async function openOptimiser(page: Page): Promise<void> {
  await page.goto("/antenna-optimiser");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await expect(page.getByRole("heading", { name: "Antenna Optimiser" })).toBeVisible();
}

test("a bounded dipole SWR task finds and exports exact NEC candidate evidence", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await openOptimiser(page);
  await page.getByTestId("optimiser-max-evaluations").fill("7");
  await page.getByTestId("run-optimisation").click();
  await expect(page.getByTestId("optimiser-status")).toContainText("Best solution found", { timeout: 120_000 });
  await expect(page.getByTestId("optimiser-radiation-cuts-azimuth")).toBeVisible();
  await expect(page.getByTestId("optimiser-radiation-cuts-elevation")).toBeVisible();
  await expect(page.getByTestId("best-solution-found")).toContainText("No global optimum is established");
  await expect(page.getByTestId("optimisation-history-chart")).toBeVisible();
  await expect(page.locator('tr[data-testid^="optimiser-history-"]')).toHaveCount(7);
  await expect(page.getByTestId("optimiser-start-final")).toContainText("Starting design vs best solution found");
  await expect(page.locator('[data-testid^="optimiser-retained-"]')).not.toHaveCount(0);
  await expect(page.getByTestId("optimiser-nec-fingerprint")).toContainText("fnv1a32-");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-optimisation").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("hf-antenna-studio-antenna-optimisation.json");
  const exported = JSON.parse(await (await import("node:fs/promises")).readFile(await download.path() as string, "utf8"));
  expect(exported.claim).toContain("Best solution found");
  expect(exported.result.globalOptimumEstablished).toBe(false);
  expect(exported.result.history).toHaveLength(7);
  expect(exported.result.bestSolution.bestSoFarScore).toBe(exported.result.bestSolution.score);
  expect(exported.result.bestSolution.solved.generatedNec).toContain("GW");
  expect(exported.result.startingDesign.parameters["dipole-length"]).toBeGreaterThan(0);

  await page.getByTestId("run-optimisation").click();
  await expect(page.getByTestId("optimiser-status")).toContainText("Best solution found", { timeout: 30_000 });
  await expect(page.getByTestId("best-solution-found")).toContainText("7 cache hits");
  expect(browserErrors).toEqual([]);
});

test("directional objectives, two dimensions, weights and constraints remain explicit", async ({ page }) => {
  await openOptimiser(page);
  await page.getByTestId("optimiser-family").selectOption("yagi");
  await page.getByTestId("optimiser-variable-yagi-height").check();
  await expect(page.getByTestId("optimiser-min-yagi-height")).toBeVisible();
  await page.getByTestId("optimiser-objective").selectOption("maximum-front-to-back");
  await page.getByTestId("optimiser-constraint-fb-enabled").check();
  await page.getByTestId("optimiser-constraint-fb").fill("5");
  await page.getByTestId("optimiser-objective").selectOption("weighted-multi-objective");
  await expect(page.getByTestId("optimiser-weight-frontToBack")).toBeVisible();
  await expect(page.getByText("Weights therefore carry inverse units and are not percentages.")).toBeVisible();
  await page.getByTestId("optimiser-max-evaluations").fill("5");
  await page.getByTestId("run-optimisation").click();
  await expect(page.getByTestId("optimiser-status")).toContainText("Best solution found", { timeout: 120_000 });
  await expect(page.getByTestId("best-solution-found")).toContainText("Local bounded search");
});

test("vertical and phased-array searches expose explicit compatible radial topology", async ({ page }) => {
  await openOptimiser(page);
  await page.getByTestId("optimiser-family").selectOption("vertical");
  await page.getByTestId("optimiser-ground").selectOption("sommerfeld-norton");
  await page.getByTestId("optimiser-vertical-radial-mode").selectOption("near-surface");
  await expect(page.getByTestId("optimiser-radial-clearance")).toBeVisible();
  await page.getByTestId("optimiser-family").selectOption("phased-array");
  await expect(page.getByTestId("optimiser-phased-radial-mode")).toHaveValue("near-surface-shared");
  await page.getByTestId("optimiser-phased-radial-count").fill("24");
  await expect(page.getByTestId("run-optimisation")).toBeEnabled();
});

test("evaluation limits, cancellation and narrow layout protect the UI", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openOptimiser(page);
  await page.getByTestId("optimiser-max-evaluations").fill("122");
  await expect(page.getByTestId("optimiser-errors")).toContainText("from 3 to 121");
  await expect(page.getByTestId("run-optimisation")).toBeDisabled();
  await page.getByTestId("optimiser-max-evaluations").fill("121");
  await page.getByTestId("run-optimisation").click();
  await expect(page.getByTestId("cancel-optimisation")).toBeVisible();
  await page.getByTestId("cancel-optimisation").click();
  await expect(page.getByTestId("optimiser-status")).toContainText("cancelled", { timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
