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
  await expect(page.getByTestId("comparison-elevation-bearing-mode")).toHaveValue("common");
  await expect(page.getByTestId("comparison-elevation-bearing")).toBeEnabled();
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

test("comparison can run two or three enabled models while retaining disabled slot settings", async ({ page }) => {
  await openComparison(page);
  await page.getByTestId("comparison-parameter-4").fill("12");
  await page.getByTestId("comparison-enabled-2").uncheck();
  await page.getByTestId("comparison-enabled-3").uncheck();
  await page.getByTestId("comparison-enabled-4").uncheck();
  await expect(page.getByTestId("run-comparison")).toHaveText("Run 1 model comparison");
  await expect(page.getByTestId("comparison-errors")).toContainText("Enable at least two model slots");
  await expect(page.getByTestId("run-comparison")).toBeDisabled();
  await page.getByTestId("comparison-enabled-2").check();
  await expect(page.getByTestId("run-comparison")).toBeEnabled();
  await page.getByTestId("run-comparison").click();
  await expect(page.getByTestId("comparison-status")).toContainText("Comparison complete · 2 models", { timeout: 120_000 });
  await expect(page.locator('[data-testid^="comparison-result-"]')).toHaveCount(2);
  await expect(page.getByTestId("comparison-parameter-4")).toHaveValue("12");
  await page.getByTestId("comparison-enabled-3").check();
  await page.getByTestId("run-comparison").click();
  await expect(page.getByTestId("comparison-status")).toContainText("Comparison complete · 3 models", { timeout: 120_000 });
  await expect(page.locator('[data-testid^="comparison-result-"]')).toHaveCount(3);
  await page.getByTestId("comparison-elevation-bearing-mode").selectOption("strongest");
  await expect(page.getByTestId("comparison-elevation-bearing")).toBeDisabled();
  await page.getByTestId("run-comparison").click();
  await expect(page.getByTestId("comparison-status")).toContainText("Comparison complete · 3 models", { timeout: 120_000 });
  await expect(page.locator('[data-testid^="comparison-elevation-bearing-result-"]')).toHaveCount(3);
  await expect(page.locator('[data-testid^="comparison-elevation-bearing-result-"]').first()).toContainText("strongest");
});

test("a saved antenna can be snapshotted into a comparison slot and solved with standard models", async ({ page }) => {
  await page.goto("/");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await page.locator('button[title^="Save project"]').first().click();
  await page.getByLabel("Project name").fill("Saved comparison dipole");
  await page.getByRole("button", { name: "Save As", exact: true }).click();
  await page.goto("/model-comparison");
  const savedOption = page.getByTestId("comparison-family-1").locator("option").filter({ hasText: "Saved comparison dipole" });
  await page.getByTestId("comparison-family-1").selectOption(await savedOption.getAttribute("value") as string);
  await expect(page.getByTestId("comparison-slot-1")).toContainText("Immutable revision");
  await expect(page.getByTestId("comparison-saved-condition-mode-1")).toHaveValue("common");
  await page.getByTestId("comparison-saved-condition-mode-1").selectOption("saved");
  await expect(page.getByTestId("comparison-slot-1")).toContainText("Saved frequency, ground and GE geometry-ground settings are preserved");
  await expect(page.getByTestId("comparison-parameter-1")).toHaveCount(0);
  await page.getByTestId("run-comparison").click();
  await expect(page.getByTestId("comparison-status")).toContainText("Comparison complete · 4 models", { timeout: 120_000 });
  await expect(page.getByTestId("comparison-result-1")).toContainText("Saved comparison dipole");
});
