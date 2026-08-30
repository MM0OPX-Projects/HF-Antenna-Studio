import { expect, test, type Page } from "@playwright/test";
import { PHASED_ARRAY_PERFECT_GROUND_CASES } from "../src/features/phased-arrays/validation-cases";

async function openLab(page: Page) {
  await page.goto("/phased-arrays");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
}

async function waitForNewResult(page: Page) {
  await expect(page.getByTestId("phased-results")).toHaveCount(0);
  await expect(page.getByTestId("phased-results")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("phased-solver-error")).toHaveCount(0);
}

function numeric(text: string): number { return Number(text.match(/[+−-]?\d+(?:\.\d+)?/)![0].replace("−", "-")); }

test("classic broadside/end-fire cases reproduce the independent exact-deck references", async ({ page }) => {
  await openLab(page);
  await expect(page.getByTestId("phased-results")).toBeVisible({ timeout: 60_000 });
  for (const [index, reference] of PHASED_ARRAY_PERFECT_GROUND_CASES.entries()) {
    if (index > 0) { await page.getByTestId(`phased-preset-${reference.id}`).click(); await waitForNewResult(page); }
    expect(numeric(await page.getByTestId("phased-result-forward").innerText())).toBeCloseTo(reference.expected.forwardGainDbi, 2);
    expect(numeric(await page.getByTestId("phased-result-reverse").innerText())).toBeCloseTo(reference.expected.reverseGainDbi, 2);
    expect(numeric(await page.getByTestId("phased-result-fb").innerText())).toBeCloseTo(reference.expected.frontToBackDb, 2);
    expect(numeric(await page.getByTestId("phased-result-heading").innerText())).toBe(reference.expected.headingDeg);
    expect(numeric(await page.getByTestId("phased-result-takeoff").innerText())).toBe(reference.expected.takeOffAngleDeg);
    expect((await page.getByTestId("phased-result-heading").innerText()).includes("axis")).toBe(reference.expected.ambiguous);
    await page.getByTestId("elevation-angle-inspector-input").fill("5");
    await expect(page.getByTestId("elevation-angle-inspector-source-current")).toContainText("Interpolated between 4.0° and 6.0° NEC samples");
    await page.getByTestId("elevation-angle-inspector-input").fill("175");
    await expect(page.getByTestId("elevation-angle-inspector-source-current")).toContainText("Interpolated between 174.0° and 176.0° NEC samples");
  }
  await page.getByTestId("phased-bearing").fill("0");
  await waitForNewResult(page);
  expect(numeric(await page.getByTestId("phased-result-heading").innerText())).toBe(180);
  await expect(page.getByTestId("phased-generated-nec")).toContainText("EX 0 1 1");
  await expect(page.getByTestId("phased-current-distribution")).toBeVisible();
  await expect(page.getByTestId("radiation-pattern-3d").locator("canvas")).toBeVisible();
});

test("rapid spacing/phase changes hide stale results and debounce the exact model", async ({ page }) => {
  await openLab(page);
  await expect(page.getByTestId("phased-results")).toBeVisible({ timeout: 60_000 });
  const geometry = page.getByTestId("phased-array-geometry-3d");
  const initialKey = await geometry.getAttribute("data-model-key");
  await page.getByTestId("phased-spacing-m").fill("4");
  await page.getByTestId("phased-spacing-m").fill("5");
  await page.getByTestId("phased-phase-2").fill("-75");
  await expect(page.getByTestId("phased-results")).toHaveCount(0);
  await expect(page.getByTestId("phased-calculation-status")).toContainText("pattern withheld");
  expect(await geometry.getAttribute("data-model-key")).not.toBe(initialKey);
  await expect(page.getByTestId("phased-results")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("phased-result-current-2")).toContainText("-75.0°");
});

test("physical feed mode emits one source, two TL cards, conversions, and solved currents", async ({ page }) => {
  await openLab(page);
  await expect(page.getByTestId("phased-results")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("phased-mode-physical").click();
  await waitForNewResult(page);
  await expect(page.getByTestId("phased-generated-nec")).toContainText("TL ");
  const deck = await page.getByTestId("phased-generated-nec").textContent();
  expect(deck?.match(/^TL /gm)).toHaveLength(2);
  expect(deck?.match(/^EX /gm)).toHaveLength(1);
  await expect(page.getByTestId("phased-network-impedance")).toBeVisible();
  await expect(page.getByTestId("phased-phase-diagram")).toContainText("NEC-solved");
  await page.getByTestId("phased-line-input").selectOption("electrical");
  await page.getByTestId("phased-line-1").fill("90");
  await waitForNewResult(page);
  await expect(page.getByText(/Line 1: .*90\.00°/)).toBeVisible();
  await page.getByTestId("phased-topology").selectOption("series-cascade");
  await expect(page.getByTestId("phased-warnings")).toContainText("does not enforce identical series current");
});

test("overlays, automatic phase sweep, ground distinctions, and invalid geometry remain explicit", async ({ page }) => {
  await openLab(page);
  await expect(page.getByTestId("phased-results")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("phased-save-comparison").click();
  await page.getByTestId("phased-preset-endfire-forward").click();
  await waitForNewResult(page);
  await page.getByTestId("phased-save-comparison").click();
  await expect(page.getByTestId("phased-comparison-panel").locator("tbody tr")).toHaveCount(2);
  await expect(page.locator('[data-testid^="polar-series-azimuth-"]')).toHaveCount(3);
  await page.getByTestId("phased-phase-sweep").click();
  await expect.poll(async () => Number(await page.getByTestId("phased-phase-2").inputValue()), { timeout: 60_000 }).toBeGreaterThan(0);
  await page.getByTestId("phased-phase-sweep").click();
  await page.getByTestId("phased-ground").selectOption("sommerfeld-norton");
  await expect(page.getByTestId("phased-radial-mode")).toHaveValue("elevated-explicit-wires");
  await expect(page.getByTestId("phased-conductivity")).toBeVisible();
  await waitForNewResult(page);
  await expect(page.getByTestId("phased-generated-nec")).toContainText("GN 2");
  await page.getByTestId("phased-element-height").fill("0");
  await expect(page.getByTestId("phased-errors")).toContainText("strictly above z = 0");
  await expect(page.getByTestId("phased-results")).toHaveCount(0);
});

test("ground-mounted phased verticals use an explicit shared radial network", async ({ page }) => {
  await openLab(page);
  await expect(page.getByTestId("phased-results")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("phased-radial-mode").selectOption("near-surface-explicit-wires");
  await expect(page.getByTestId("phased-radial-topology")).toHaveValue("shared-bonded-network");
  await expect(page.getByTestId("phased-ground")).toHaveValue("sommerfeld-norton");
  await expect(page.getByTestId("phased-ground")).toBeDisabled();
  await expect(page.getByTestId("phased-array-geometry-3d")).toHaveAttribute("data-wire-count", "20");
  await expect(page.getByTestId("phased-warnings")).toContainText("cannot solve buried or exactly-on-soil wires");
  await expect(page.getByTestId("phased-generated-nec")).toContainText("topology: shared-bonded-network");
  await expect(page.getByTestId("phased-generated-nec")).toContainText("GE -1\nGN 2");
  await expect(page.getByTestId("phased-results")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("phased-current-visualisation")).toBeVisible();
  expect(Math.abs(numeric(await page.getByTestId("phased-result-fb").innerText()))).toBeLessThanOrEqual(0.05);
  await expect(page.getByTestId("phased-result-heading")).toContainText("axis");
  await expect(page.getByTestId("phased-result-current-1")).toContainText("1.0000 ∠ 0.0° A");
  await expect(page.getByTestId("phased-result-current-2")).toContainText("1.0000 ∠ 0.0° A");

  await page.getByTestId("phased-mode-physical").click();
  await waitForNewResult(page);
  await expect(page.getByTestId("phased-network-impedance")).toBeVisible();
  await expect(page.getByTestId("phased-generated-nec")).toContainText("TL ");

  await page.getByTestId("phased-radial-topology").selectOption("independent-per-element");
  await expect(page.getByTestId("phased-errors")).toContainText("Independent near-surface radial fields overlap");
  await expect(page.getByTestId("phased-results")).toHaveCount(0);
});

test("narrow layout and keyboard sliders produce no browser errors", async ({ page }) => {
  const consoleErrors: string[] = []; const pageErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await openLab(page);
  await expect(page.getByRole("heading", { name: "Two-element phased vertical arrays" })).toBeVisible();
  await page.getByTestId("phased-spacing-m-slider").focus();
  const before = Number(await page.getByTestId("phased-spacing-m-slider").inputValue());
  await page.getByTestId("phased-spacing-m-slider").press("ArrowRight");
  expect(Number(await page.getByTestId("phased-spacing-m-slider").inputValue())).toBeGreaterThan(before);
  await expect(page.getByTestId("phased-results")).toBeVisible({ timeout: 60_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(consoleErrors).toEqual([]); expect(pageErrors).toEqual([]);
});
