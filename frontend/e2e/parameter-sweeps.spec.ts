import { expect, test, type Page } from "@playwright/test";

async function openSweeps(page: Page): Promise<void> {
  await page.goto("/parameter-sweeps");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await expect(page.getByRole("heading", { name: "Parameter Sweeps" })).toBeVisible();
}

test("a three-point dipole height sweep preserves exact model/NEC evidence and uses its cache", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await openSweeps(page);
  await page.getByTestId("parameter-axis-start-1").fill("5");
  await page.getByTestId("parameter-axis-stop-1").fill("10");
  await page.getByTestId("parameter-axis-points-1").fill("3");
  await expect(page.getByTestId("parameter-job-count")).toHaveText("3/81");
  await page.getByTestId("run-parameter-sweep").click();
  await expect(page.getByTestId("parameter-status")).toContainText("3 points complete", { timeout: 120_000 });
  await expect(page.getByTestId("parameter-radiation-cuts-azimuth")).toBeVisible();
  await expect(page.getByTestId("parameter-radiation-cuts-elevation")).toBeVisible();
  await expect(page.locator('tr[data-testid^="parameter-result-"]')).toHaveCount(3);
  await expect(page.getByTestId("parameter-sweep-line-chart")).toBeVisible();
  await expect(page.locator('[data-testid="parameter-nec-fingerprint"]')).toContainText("fnv1a32-");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-parameter-sweep").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("hf-antenna-studio-parameter-sweep.json");
  const json = JSON.parse(await (await import("node:fs/promises")).readFile(await download.path() as string, "utf8"));
  expect(json.format).toBe("hf-antenna-studio-parameter-sweep");
  expect(json.result.points.map((point: { parameterValues: Record<string, number> }) => point.parameterValues["dipole-height"])).toEqual([5, 7.5, 10]);
  expect(new Set(json.result.points.map((point: { modelKey: string }) => point.modelKey)).size).toBe(3);
  expect(json.result.points.every((point: { generatedNec: string; necFingerprint: string }) => point.generatedNec.includes("GW") && point.necFingerprint.startsWith("fnv1a32-"))).toBe(true);

  await page.getByTestId("run-parameter-sweep").click();
  await expect(page.getByTestId("parameter-status")).toContainText("3 cache hits", { timeout: 30_000 });
  expect(browserErrors).toEqual([]);
});

test("a bounded vertical length/radial-count grid renders as a selectable heat map", async ({ page }) => {
  await openSweeps(page);
  await page.getByTestId("parameter-family").selectOption("vertical");
  await page.getByTestId("parameter-ground").selectOption("sommerfeld-norton");
  await page.getByTestId("parameter-vertical-radial-mode").selectOption("near-surface");
  await expect(page.getByTestId("parameter-radial-clearance")).toBeVisible();
  await page.getByTestId("parameter-mode-2d").click();
  await expect(page.getByTestId("parameter-axis-select-1")).toHaveValue("vertical-length");
  await expect(page.getByTestId("parameter-axis-select-2")).toHaveValue("radial-count");
  await page.getByTestId("parameter-axis-start-1").fill("4");
  await page.getByTestId("parameter-axis-stop-1").fill("5");
  await page.getByTestId("parameter-axis-points-1").fill("2");
  await page.getByTestId("parameter-axis-start-2").fill("4");
  await page.getByTestId("parameter-axis-stop-2").fill("8");
  await page.getByTestId("parameter-axis-points-2").fill("2");
  await expect(page.getByTestId("parameter-job-count")).toHaveText("4/81");
  await page.getByTestId("run-parameter-sweep").click();
  await expect(page.getByTestId("parameter-status")).toContainText("4 points complete", { timeout: 120_000 });
  await expect(page.locator('[data-testid^="parameter-heat-cell-"]')).toHaveCount(4);
  await page.getByTestId("parameter-heat-cell-3").click();
  await expect(page.getByTestId("parameter-point-detail")).toContainText("Exact point 4");
  await expect(page.getByTestId("parameter-result-3")).toContainText("fnv1a32-");
});

test("job limits, cancellation and narrow-screen layout remain safe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSweeps(page);
  await page.getByTestId("parameter-mode-2d").click();
  await page.getByTestId("parameter-axis-points-1").fill("10");
  await page.getByTestId("parameter-axis-points-2").fill("10");
  await expect(page.getByTestId("parameter-errors")).toContainText("maximum is 81");
  await expect(page.getByTestId("run-parameter-sweep")).toBeDisabled();
  await page.getByTestId("parameter-mode-1d").click();
  await page.getByTestId("parameter-axis-points-1").fill("81");
  await page.getByTestId("run-parameter-sweep").click();
  await expect(page.getByTestId("cancel-parameter-sweep")).toBeVisible();
  await page.getByTestId("cancel-parameter-sweep").click();
  await expect(page.getByTestId("parameter-status")).toContainText("cancelled", { timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
