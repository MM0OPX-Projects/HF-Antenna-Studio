import { expect, test, type Page } from "@playwright/test";
import { antennaTemplateDefinitions } from "../src/features/antenna-templates/definitions";
import { toDisplayUnit } from "../src/features/antenna-templates/units";
import { TEMPLATE_REGRESSION_CASES } from "../src/features/antenna-templates/regression-cases";

async function openStudio(page: Page) {
  await page.goto("/antenna-templates");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
}

const isWindowsCi = process.platform === "win32" && Boolean(process.env.CI);
const aggregateTemplateSolverTimeoutMs = isWindowsCi ? 1_200_000 : 120_000;
const aggregateTemplateUiTimeoutMs = isWindowsCi ? 600_000 : 120_000;
const templateResultTimeoutMs = isWindowsCi ? 120_000 : 30_000;

test("all eight templates generate geometry, feed/segments, NEC, and solve locally", async ({ page }) => {
  test.setTimeout(aggregateTemplateSolverTimeoutMs);
  await openStudio(page);
  for (const reference of TEMPLATE_REGRESSION_CASES) {
    const definition = antennaTemplateDefinitions.find((item) => item.id === reference.id)!;
    await page.getByTestId(`template-${definition.id}`).click();
    await expect(page.getByTestId("template-param-wireDiameterM"), `${definition.id} default wire diameter`).toHaveValue("1");
    const comparatorDiameterMm = definition.id === "ground-plane-vertical" ? "4" : "2";
    await page.getByTestId("template-param-wireDiameterM").fill(comparatorDiameterMm);
    await expect(page.getByTestId("template-param-wireDiameterM")).toHaveValue(comparatorDiameterMm);
    await expect(page.getByTestId("template-geometry-3d"), definition.id).toHaveAttribute("data-template-id", definition.id);
    await expect(page.getByTestId("template-wire-count"), definition.id).not.toHaveText("0");
    await expect(page.getByTestId("template-segment-count"), definition.id).not.toHaveText("—");
    await expect(page.getByTestId("template-feed-segment"), definition.id).not.toHaveText("—");
    await expect(page.getByTestId("template-errors"), definition.id).toHaveCount(0);
    const deck = await page.getByTestId("template-generated-nec").textContent() ?? "";
    expect(deck, definition.id).toContain("GW ");
    expect(deck, definition.id).toContain("EX 0 ");
    expect(deck, definition.id).toContain("Generated dimensions are starting points");

    await page.getByTestId("run-template-nec").click();
    await expect(page.getByTestId("template-results"), `${definition.id} solver result`).toBeVisible({ timeout: templateResultTimeoutMs });
    await expect(page.getByTestId("template-solver-error"), definition.id).toHaveCount(0);
    const impedanceText = (await page.getByTestId("template-result-impedance").innerText()).replace("−", "-");
    const impedance = impedanceText.match(/^([+-]?\d+(?:\.\d+)?)\s+([+-])\s+j(\d+(?:\.\d+)?)/);
    expect(impedance, definition.id).not.toBeNull();
    const resistance = Number(impedance![1]);
    const reactance = Number(impedance![3]) * (impedance![2] === "-" ? -1 : 1);
    const gain = Number((await page.getByTestId("template-result-gain").innerText()).match(/[+-]?\d+(?:\.\d+)?/)![0]);
    const takeOff = Number((await page.getByTestId("template-result-takeoff").innerText()).match(/[+-]?\d+(?:\.\d+)?/)![0]);
    expect(resistance, `${definition.id} resistance`).toBeCloseTo(reference.expected.resistanceOhm, 1);
    expect(reactance, `${definition.id} reactance`).toBeCloseTo(reference.expected.reactanceOhm, 1);
    expect(gain, `${definition.id} gain`).toBeCloseTo(reference.expected.maximumGainDbi, 1);
    expect(takeOff, `${definition.id} take-off`).toBeCloseTo(reference.expected.takeOffAngleDeg, 1);
    await expect(page.getByTestId("template-pattern-cuts"), `${definition.id} pattern cuts`).toBeVisible();
    await expect(page.getByTestId("elevation-angle-inspector-source-current"), `${definition.id} 5-degree sample`).toHaveText("Exact NEC sample");
    await page.getByTestId("elevation-angle-inspector-input").fill("175");
    await expect(page.getByTestId("elevation-angle-inspector-source-current"), `${definition.id} 175-degree sample`).toHaveText("Exact NEC sample");
    await page.getByTestId("elevation-angle-inspector-input").fill("5");
    await page.getByTestId("azimuth-cut-elevation-input").fill("5");
    await expect(page.getByTestId("azimuth-cut-actual-elevation"), `${definition.id} azimuth row`).toContainText("NEC row 5.0°");
    await page.getByTestId("azimuth-bearing-inspector-input").fill("45");
    await expect(page.getByTestId("azimuth-bearing-inspector-source-current"), `${definition.id} azimuth bearing`).toHaveText("Exact NEC sample");
  }
});

test("the common parameter UI enforces every declared range", async ({ page }) => {
  test.setTimeout(aggregateTemplateUiTimeoutMs);
  await openStudio(page);
  for (const definition of antennaTemplateDefinitions) {
    await page.getByTestId(`template-${definition.id}`).click();
    await expect(page.getByRole("heading", { name: "Common parameter controls" })).toHaveCount(1);
    for (const parameter of definition.parameters) {
      const input = page.getByTestId(`template-param-${parameter.key}`);
      await expect(input, `${definition.id}/${parameter.key}`).toBeVisible();
      const unit = parameter.metricUnit;
      expect(Number(await input.getAttribute("min"))).toBeCloseTo(toDisplayUnit(parameter.minSI, unit), 8);
      expect(Number(await input.getAttribute("max"))).toBeCloseTo(toDisplayUnit(parameter.maxSI, unit), 8);
      await expect(page.getByTestId(`template-param-${parameter.key}-slider`)).toBeVisible();
    }
  }
});

test("band presets regenerate starting dimensions until a manual override is made", async ({ page }) => {
  await openStudio(page);
  const length = page.getByTestId("template-param-totalLengthM");
  await page.getByTestId("band-40m").click();
  await expect(page.getByTestId("template-param-frequencyHz")).toHaveValue("7.1");
  const linkedLength = Number(await length.inputValue());
  expect(linkedLength).toBeGreaterThan(19);

  await length.fill("12");
  await expect(page.getByTestId("dimension-mode")).toHaveText("Manual dimensions");
  await expect(page.getByTestId("template-geometry-3d")).toHaveAttribute("data-total-wire-length-m", "12.0000");
  await page.getByTestId("band-20m").click();
  await expect(page.getByTestId("template-param-frequencyHz")).toHaveValue("14.1");
  await expect(length).toHaveValue("12");

  await page.getByTestId("restore-starting-dimensions").click();
  await expect(page.getByTestId("dimension-mode")).toHaveText("Frequency-linked start");
  expect(Number(await length.inputValue())).toBeCloseTo(10.1, 2);
});

test("the shared workbench remains usable at a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStudio(page);
  await expect(page.getByRole("heading", { name: "Antenna template studio" })).toBeVisible();
  await expect(page.getByTestId("template-horizontal-dipole")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Common parameter controls" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("unsafe parameter combinations stop NEC instead of silently changing geometry", async ({ page }) => {
  await openStudio(page);
  await page.getByTestId("template-ground-plane-vertical").click();
  await page.getByTestId("template-param-baseHeightM").fill("0.25");
  await page.getByTestId("template-param-radialDroopRad").fill("45");
  await expect(page.getByTestId("template-errors")).toContainText("above the ground plane");
  await expect(page.getByTestId("run-template-nec")).toBeDisabled();
  await expect(page.getByTestId("template-generated-nec")).toContainText("Resolve geometry errors");
});

test("an out-of-range exact value is reported instead of silently clamped", async ({ page }) => {
  await openStudio(page);
  await page.getByTestId("template-param-totalLengthM").fill("300");
  await expect(page.getByTestId("template-param-totalLengthM")).toHaveValue("300");
  await expect(page.getByTestId("template-errors")).toContainText("outside its allowed range");
  await expect(page.getByTestId("run-template-nec")).toBeDisabled();
});

test("metric/imperial changes display units without changing the internal model", async ({ page }) => {
  await openStudio(page);
  const metricHeight = Number(await page.getByTestId("template-param-heightM").inputValue());
  const deckBefore = await page.getByTestId("template-generated-nec").textContent();
  await page.getByTestId("template-units").click();
  await expect(page.getByTestId("template-units")).toHaveText("Imperial");
  const imperialHeight = Number(await page.getByTestId("template-param-heightM").inputValue());
  expect(imperialHeight).toBeCloseTo(metricHeight / 0.3048, 3);
  expect(await page.getByTestId("template-generated-nec").textContent()).toBe(deckBefore);
});
