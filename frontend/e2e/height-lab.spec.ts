import { expect, test } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";

async function openLab(page: import("@playwright/test").Page) {
  await page.goto("/dipole-height-lab");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
}

test("rapid height changes hide stale results and solve only the settled geometry", async ({ page }) => {
  await openLab(page);
  await expect(page.getByTestId("height-results")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("height-preset-0.1").click();
  await page.getByTestId("height-preset-0.25").click();
  await page.getByTestId("height-preset-1").click();

  await expect(page.getByTestId("height-wavelengths")).toHaveText("1.00λ");
  await expect(page.getByTestId("geometry-3d")).toHaveAttribute("data-height-wavelengths", "1.00");
  await expect(page.getByTestId("height-results")).toHaveCount(0);
  await expect(page.getByTestId("calculation-status")).toContainText("previous current trace is hidden");
  await expect(page.getByTestId("radiation-pattern-3d")).toContainText("Pattern withheld");

  await expect(page.getByTestId("height-results")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("calculation-status")).toContainText("Geometry is now at 1.00λ");
  await expect(page.getByTestId("height-result-takeoff")).toHaveText("15.0°");
});

test("metres and feet edit the same SI height", async ({ page }) => {
  await openLab(page);
  await expect(page.getByTestId("exact-height")).toHaveValue("10.6309");
  await page.getByTestId("height-unit").selectOption("ft");
  expect(Number(await page.getByTestId("exact-height").inputValue())).toBeCloseTo(34.8783, 3);
  await page.getByTestId("exact-height").fill("17.4392");
  await expect(page.getByTestId("height-wavelengths")).toHaveText("0.25λ");
  expect(Number((await page.getByTestId("height-metres").innerText()).split(" ")[0])).toBeCloseTo(5.3155, 3);
});

test("ground presets expose the NEC real-ground parameters", async ({ page }) => {
  await openLab(page);
  await page.getByTestId("ground-preset").selectOption("average");
  await expect(page.getByTestId("lab-conductivity")).toBeEnabled();
  await expect(page.getByTestId("lab-conductivity")).toHaveValue("0.005");
  await expect(page.getByTestId("lab-permittivity")).toHaveValue("13");
  await page.getByTestId("lab-conductivity").fill("0.008");
  await expect(page.getByTestId("ground-preset")).toHaveValue("custom");
});

test("four saved traces overlay the current pattern and a fifth is refused", async ({ page }) => {
  await openLab(page);
  for (const height of ["0.1", "0.25", "0.5", "1"]) {
    await page.getByTestId(`height-preset-${height}`).click();
    await expect(page.getByTestId("height-results")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("save-comparison").click();
  }
  await expect(page.getByText("4/4 saved")).toBeVisible();
  await expect(page.locator('[data-testid^="polar-series-elevation-comparison-"]')).toHaveCount(4);
  await page.getByTestId("height-preset-2").click();
  await expect(page.getByTestId("height-results")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("save-comparison")).toBeDisabled();
  await expect(page.locator('[data-testid^="polar-series-elevation-"]')).toHaveCount(5);
});

test("pattern modes, automatic sweep, reset, and exports remain interactive", async ({ page }) => {
  await openLab(page);
  await expect(page.getByTestId("height-results")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("elevation-angle-inspector-input")).toHaveValue("5");
  await expect(page.getByTestId("elevation-angle-inspector-source-current")).toHaveText("Exact NEC sample");
  await page.getByTestId("elevation-angle-inspector-input").fill("7.5");
  await expect(page.getByTestId("elevation-angle-inspector-source-current")).toContainText("Interpolated between 5.0° and 10.0° NEC samples");
  await expect(page.getByTestId("elevation-angle-inspector-gain-current")).toContainText("dBi");
  await page.getByTestId("elevation-polar-plot").focus();
  await page.getByTestId("elevation-polar-plot").press("ArrowUp");
  await expect(page.getByTestId("elevation-angle-inspector-input")).toHaveValue("8.5");
  const plotBounds = await page.getByTestId("elevation-polar-plot").boundingBox();
  expect(plotBounds).not.toBeNull();
  await page.getByTestId("elevation-polar-plot").click({ position: { x: plotBounds!.width / 2, y: plotBounds!.height * 0.2 } });
  expect(Number(await page.getByTestId("elevation-angle-inspector-input").inputValue())).toBeGreaterThan(80);
  const absolutePath = await page.getByTestId("polar-series-elevation-current").getAttribute("d");
  await page.getByTestId("mode-normalised").click();
  await expect(page.getByTestId("mode-normalised")).toHaveAttribute("aria-checked", "true");
  const normalisedPath = await page.getByTestId("polar-series-elevation-current").getAttribute("d");
  expect(normalisedPath).not.toBe(absolutePath);
  expect(normalisedPath).not.toContain("NaN");

  const csvDownload = page.waitForEvent("download");
  await page.getByTestId("export-csv").click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toBe("dipole-height-comparison.csv");
  const csvPath = await csv.path();
  expect(csvPath).not.toBeNull();
  expect(await readFile(csvPath!, "utf8")).toContain('"plane","angle_deg","gain_dbi","normalised_db"');
  const pngDownload = page.waitForEvent("download");
  await page.getByTestId("export-png").click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toBe("dipole-height-elevation.png");
  const pngPath = await png.path();
  expect(pngPath).not.toBeNull();
  expect((await stat(pngPath!)).size).toBeGreaterThan(1_000);

  await page.getByTestId("sweep-animation").click();
  await expect(page.getByTestId("sweep-animation")).toHaveText("Stop sweep");
  await expect(page.getByTestId("height-wavelengths")).toHaveText("2.00λ", { timeout: 30_000 });
  await expect(page.getByTestId("sweep-animation")).toHaveText("Auto sweep");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByTestId("height-wavelengths")).toHaveText("0.50λ");
  await expect(page.getByTestId("mode-absolute")).toHaveAttribute("aria-checked", "true");
});

test("slider keyboard control and mobile layout remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLab(page);
  const slider = page.getByTestId("height-slider");
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(page.getByTestId("height-wavelengths")).toHaveText("0.51λ");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expect(page.getByTestId("side-view-diagram")).toBeVisible();
  await expect(page.getByTestId("geometry-3d").locator("canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle navigation menu" })).toBeVisible();
});
