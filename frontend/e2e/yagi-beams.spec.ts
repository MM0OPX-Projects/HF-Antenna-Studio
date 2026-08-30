import { expect, test, type Locator, type Page } from "@playwright/test";
import { NIST_SCALED_THREE_ELEMENT_SANITY, YAGI_PERFECT_GROUND_REGRESSION_CASES } from "../src/features/yagi-beams/validation-cases";

async function openYagis(page: Page) {
  await page.goto("/yagi-beams");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
}

async function waitForSolved(page: Page) {
  await expect(page.getByTestId("yagi-results")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("yagi-solver-error")).toHaveCount(0);
}

function numeric(text: string): number { return Number(text.match(/[+−-]?\d+(?:\.\d+)?/)![0].replace("−", "-")); }

async function impedance(locator: Locator): Promise<{ resistance: number; reactance: number }> {
  const text = (await locator.innerText()).replace("−", "-");
  const match = text.match(/^([+-]?\d+(?:\.\d+)?)\s+([+-])\s+j(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Could not parse impedance: ${text}`);
  return { resistance: Number(match[1]), reactance: Number(match[3]) * (match[2] === "-" ? -1 : 1) };
}

test("2/3/5-element perfect-ground fixtures reproduce the independent NEC-2D comparison", async ({ page }) => {
  await openYagis(page);
  await page.getByTestId("yagi-ground").selectOption("perfect");
  for (const reference of YAGI_PERFECT_GROUND_REGRESSION_CASES) {
    await page.getByTestId(`yagi-preset-${reference.elements}`).click();
    await expect(page.getByTestId("yagi-element-count")).toHaveText(String(reference.elements));
    await expect(page.getByTestId("yagi-generated-nec")).toContainText("GE 1\nGN 1");
    await waitForSolved(page);
    const z = await impedance(page.getByTestId("yagi-result-impedance"));
    expect(z.resistance).toBeCloseTo(reference.expected.resistanceOhm, 1);
    expect(z.reactance).toBeCloseTo(reference.expected.reactanceOhm, 1);
    expect(numeric(await page.getByTestId("yagi-result-forward-gain").innerText())).toBeCloseTo(reference.expected.forwardGainDbi, 1);
    expect(numeric(await page.getByTestId("yagi-result-rear-gain").innerText())).toBeCloseTo(reference.expected.rearGainDbi, 1);
    expect(numeric(await page.getByTestId("yagi-result-takeoff").innerText())).toBe(reference.expected.takeOffAngleDeg);
    await expect(page.getByTestId("yagi-current-distribution")).toBeVisible();
    await expect(page.getByTestId("yagi-phase-driven")).toBeVisible();
    await page.getByTestId("elevation-angle-inspector-input").fill("5");
    await expect(page.getByTestId("elevation-angle-inspector-source-current")).toContainText("Interpolated between 4.0° and 6.0° NEC samples");
    const forwardFiveDegreeGain = numeric(await page.getByTestId("elevation-angle-inspector-gain-current").innerText());
    await page.getByTestId("elevation-angle-inspector-input").fill("175");
    await expect(page.getByTestId("elevation-angle-inspector-source-current")).toContainText("Interpolated between 174.0° and 176.0° NEC samples");
    expect(numeric(await page.getByTestId("elevation-angle-inspector-gain-current").innerText())).toBeLessThan(forwardFiveDegreeGain);
    await expect(page.getByTestId("radiation-pattern-3d").locator("canvas")).toBeVisible();
  }
});

test("rapid slider edits hide stale results, debounce, and publish only the latest geometry", async ({ page }) => {
  await openYagis(page);
  await waitForSolved(page);
  const geometry = page.getByTestId("yagi-geometry-3d");
  const initialKey = await geometry.getAttribute("data-model-key");
  await page.getByTestId("yagi-height").fill("8");
  await page.getByTestId("yagi-height").fill("12");
  await page.getByTestId("yagi-reflector-spacing").fill("3.5");
  await expect(page.getByTestId("yagi-results")).toHaveCount(0);
  await expect(page.getByTestId("yagi-calculation-status")).toContainText("waiting for a stable input");
  expect(await geometry.getAttribute("data-model-key")).not.toBe(initialKey);
  await waitForSolved(page);
  await expect(page.getByTestId("yagi-calculation-status")).toContainText("Calculation complete");
  expect(await page.getByTestId("yagi-generated-nec").textContent()).toContain("-3.5 12");
});

test("comparison mode overlays four immutable traces and enforces its limit", async ({ page }) => {
  await openYagis(page);
  for (const elements of [2, 3, 5, 4]) {
    if (elements === 4) await page.getByTestId("yagi-director-count").fill("2");
    else await page.getByTestId(`yagi-preset-${elements}`).click();
    await waitForSolved(page);
    await page.getByTestId("yagi-save-comparison").click();
  }
  await expect(page.getByTestId("yagi-comparison-panel").locator("tbody tr")).toHaveCount(4);
  await expect(page.getByTestId("yagi-save-comparison")).toBeDisabled();
  await expect(page.locator('[data-testid^="polar-series-azimuth-"]')).toHaveCount(5);
  await page.getByTestId("yagi-pattern-mode").click();
  await expect(page.getByTestId("yagi-pattern-mode")).toHaveText("Relative to peak");
  await expect(page.getByTestId("elevation-angle-inspector-gain-current")).toContainText("dB below cut peak");
  await expect(page.getByTestId("elevation-angle-inspector-context-current")).toContainText("dBi absolute");
});

test("ground, reference impedance, configurable directors, and validity checks remain explicit", async ({ page }) => {
  await openYagis(page);
  await page.getByTestId("yagi-director-count").fill("6");
  await expect(page.getByTestId("yagi-element-count")).toHaveText("8");
  await expect(page.getByTestId("yagi-generated-nec")).toContainText("GW 8");
  await page.getByTestId("yagi-ground").selectOption("perfect");
  await expect(page.getByTestId("yagi-generated-nec")).toContainText("GN 1");
  await waitForSolved(page);
  const swr50 = await page.getByTestId("yagi-result-swr").innerText();
  await page.getByTestId("yagi-reference-impedance").selectOption("75");
  await waitForSolved(page);
  expect(await page.getByTestId("yagi-result-swr").innerText()).not.toBe(swr50);
  await page.getByTestId("yagi-reflector-spacing").fill("0.01");
  await expect(page.getByTestId("yagi-errors")).toContainText("between 0.1 and 30");
  await expect(page.getByTestId("yagi-results")).toHaveCount(0);
  await expect(page.getByTestId("yagi-generated-nec")).toContainText("Resolve validity errors");
});

test("scaled NBS/NIST 3-element geometry falls within the published pattern sanity envelope", async ({ page }) => {
  await openYagis(page);
  const reference = NIST_SCALED_THREE_ELEMENT_SANITY;
  const lambda = 299_792_458 / reference.frequencyHz;
  await page.getByTestId("yagi-preset-3").click();
  await page.getByTestId("yagi-frequency").fill(String(reference.frequencyHz / 1e6));
  await page.getByTestId("yagi-driven-length").fill(String(reference.drivenLengthWavelengths * lambda));
  await page.getByTestId("yagi-reflector-length").fill(String(reference.reflectorLengthWavelengths * lambda));
  await page.getByTestId("yagi-director-1-length").fill(String(reference.directorLengthWavelengths * lambda));
  await page.getByTestId("yagi-reflector-spacing").fill(String(reference.reflectorSpacingWavelengths * lambda));
  await page.getByTestId("yagi-director-1-spacing").fill(String(reference.directorSpacingWavelengths * lambda));
  await page.getByTestId("yagi-height").fill(String(reference.heightWavelengths * lambda));
  await page.getByTestId("yagi-ground").selectOption("perfect");
  await waitForSolved(page);
  const beamwidth = numeric(await page.getByTestId("yagi-result-beamwidth").innerText());
  const fb = numeric(await page.getByTestId("yagi-result-fb").innerText());
  expect(beamwidth).toBeGreaterThan(49);
  expect(beamwidth).toBeLessThan(80);
  expect(fb).toBeGreaterThan(reference.publishedRearSuppressionDb);
});

test("keyboard and narrow viewport sanity checks pass without browser errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await openYagis(page);
  await expect(page.getByRole("heading", { name: "Parametric Yagi beam models" })).toBeVisible();
  await page.getByTestId("yagi-height-slider").focus();
  const before = Number(await page.getByTestId("yagi-height-slider").inputValue());
  await page.getByTestId("yagi-height-slider").press("ArrowRight");
  expect(Number(await page.getByTestId("yagi-height-slider").inputValue())).toBeGreaterThan(before);
  await waitForSolved(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
