import { expect, test, type Page } from "@playwright/test";

async function openComparison(page: Page): Promise<void> {
  await page.goto("/model-comparison");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await expect(page.getByRole("heading", { name: "Model Comparison" })).toBeVisible();
}

test("four different antenna models solve under common conditions and export an offline HTML report", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await openComparison(page);
  await expect(page.locator('[data-testid^="comparison-slot-"]')).toHaveCount(4);
  await expect(page.getByTestId("comparison-condition-summary")).toContainText("14.100 MHz");
  await page.getByTestId("run-comparison").click();
  await expect(page.getByTestId("comparison-status")).toContainText("Comparison complete · 4 models", { timeout: 120_000 });
  await expect(page.locator('[data-testid^="comparison-result-"]')).toHaveCount(4);
  await expect(page.getByTestId("comparison-result-3")).toContainText("N/A");
  await expect(page.locator('[data-testid^="polar-series-azimuth-model-"]')).toHaveCount(4);
  await expect(page.locator('[data-testid^="polar-series-elevation-model-"]')).toHaveCount(4);
  await expect(page.locator('[data-testid^="elevation-angle-inspector-gain-model-"]')).toHaveCount(4);
  await expect(page.locator('[data-testid^="elevation-angle-inspector-source-model-"]')).toHaveCount(4);
  await expect(page.locator('[data-testid^="elevation-angle-inspector-gain-model-"]').first()).toContainText("dB relative to cut peak");
  await expect(page.locator('[data-testid^="elevation-angle-inspector-context-model-"]').first()).toHaveText("Cut peak is 0.00 dB in this view");
  await page.getByTestId("elevation-angle-inspector-input").fill("175");
  await expect(page.getByTestId("elevation-angle-inspector-input")).toHaveValue("175");
  await expect(page.locator('[data-testid^="elevation-angle-inspector-gain-model-"]')).toHaveCount(4);
  await page.getByTestId("comparison-pattern-mode").click();
  await expect(page.getByTestId("comparison-pattern-mode")).toHaveText("Absolute gain (dBi)");
  await expect(page.locator('[data-testid^="elevation-angle-inspector-gain-model-"]').first()).toContainText("dBi");
  await expect(page.locator('[data-testid^="elevation-angle-inspector-context-model-"]').first()).toContainText("Cut peak");
  await expect(page.locator('[data-testid^="elevation-angle-inspector-context-model-"]').first()).toContainText("dBi");
  await expect(page.getByTestId("comparison-sweep-series-count")).toHaveText("3");
  await page.getByTestId("comparison-sweep-resistance").click();
  await expect(page.getByTestId("comparison-sweep-resistance")).toHaveAttribute("aria-pressed", "true");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-comparison-html").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("hf-antenna-studio-model-comparison.html");
  const html = await (await import("node:fs/promises")).readFile(await download.path() as string, "utf8");
  expect(html).toContain("HF Antenna Studio model comparison");
  expect(html).toContain("Horizontal dipole");
  expect(html).toContain("Two-element phased array");
  expect(html).toContain("Exact generated NEC models");

  await page.getByTestId("comparison-frequency").fill("14.2");
  await expect(page.getByTestId("comparison-condition-warnings")).toContainText("differ from the current common-condition controls");
  await expect(page.locator('[data-testid^="polar-series-azimuth-model-"]')).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test("comparison examples expose dipole height, radial count, array phase and Yagi height states on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openComparison(page);
  await page.getByTestId("comparison-preset-dipole").click();
  await expect(page.getByTestId("comparison-parameter-1")).toHaveValue("5");
  await expect(page.getByTestId("comparison-parameter-2")).toHaveValue("10");
  await page.getByTestId("comparison-preset-vertical").click();
  await expect(page.getByTestId("comparison-parameter-4")).toHaveValue("16");
  await page.getByTestId("comparison-preset-phased").click();
  await expect(page.getByTestId("comparison-parameter-2")).toHaveValue("90");
  await page.getByTestId("comparison-preset-yagi").click();
  await expect(page.getByTestId("comparison-parameter-1")).toHaveValue("5");
  await expect(page.getByTestId("comparison-parameter-2")).toHaveValue("10");
  await page.getByTestId("comparison-ground").selectOption("sommerfeld-norton");
  await expect(page.getByTestId("comparison-conductivity")).toBeVisible();
  await expect(page.getByTestId("comparison-permittivity")).toBeVisible();
  await page.getByTestId("comparison-preset-vertical").click();
  await expect(page.getByTestId("comparison-radial-workflow")).toBeVisible();
  await page.getByTestId("comparison-vertical-radial-mode").selectOption("near-surface");
  await expect(page.getByTestId("comparison-radial-clearance")).toBeVisible();
  await expect(page.getByTestId("comparison-errors")).toContainText("at least four explicit radial wires");
  await expect(page.getByTestId("run-comparison")).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
