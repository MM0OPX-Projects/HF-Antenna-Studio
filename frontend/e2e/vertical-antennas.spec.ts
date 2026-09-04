import { expect, test, type Locator, type Page } from "@playwright/test";
import { IDEAL_VERTICAL_REGRESSION_CASES } from "../src/features/vertical-antennas/validation-cases";

async function openVerticals(page: Page) {
  await page.goto("/vertical-antennas");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await page.getByLabel("Global antenna wire material").selectOption("perfect");
}

async function runAndWait(page: Page) {
  await page.getByTestId("run-vertical-nec").click();
  await expect(page.getByTestId("vertical-results")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("vertical-solver-error")).toHaveCount(0);
}

async function impedance(locator: Locator): Promise<{ resistance: number; reactance: number }> {
  const text = (await locator.innerText()).replace("−", "-");
  const match = text.match(/^([+-]?\d+(?:\.\d+)?)\s+([+-])\s+j(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Could not parse impedance: ${text}`);
  return { resistance: Number(match[1]), reactance: Number(match[3]) * (match[2] === "-" ? -1 : 1) };
}

function numericResult(text: string): number {
  return Number(text.match(/[+−-]?\d+(?:\.\d+)?/)![0].replace("−", "-"));
}

test("40/20/10m ideal monopoles match the recorded local NEC regression and analytic sanity bounds", async ({ page }) => {
  await openVerticals(page);
  await expect(page.getByTestId("vertical-radiator-diameter")).toHaveValue("1");
  await expect(page.getByTestId("vertical-radial-diameter")).toHaveValue("1");
  await page.getByTestId("vertical-radiator-diameter").fill("2");
  await page.getByTestId("vertical-radial-diameter").fill("2");
  await page.getByTestId("vertical-mode-ground-mounted-ideal").click();
  for (const reference of IDEAL_VERTICAL_REGRESSION_CASES) {
    await page.getByTestId(`vertical-band-${reference.band}`).click();
    await expect(page.getByTestId("vertical-errors"), reference.band).toHaveCount(0);
    const deck = await page.getByTestId("vertical-generated-nec").textContent() ?? "";
    expect(deck, reference.band).toContain("GE 1\nGN 1");
    expect(deck, reference.band).toContain(`FR 0 1 0 0 ${reference.frequencyHz / 1e6} 0`);
    await runAndWait(page);
    const z = await impedance(page.getByTestId("vertical-result-impedance"));
    const gain = Number((await page.getByTestId("vertical-result-gain").innerText()).match(/[+-]?\d+(?:\.\d+)?/)![0]);
    const takeOff = Number((await page.getByTestId("vertical-result-takeoff").innerText()).match(/[+-]?\d+(?:\.\d+)?/)![0]);
    const azimuthVariation = Number((await page.getByTestId("vertical-result-azimuth-variation").innerText()).match(/[+-]?\d+(?:\.\d+)?/)![0]);
    expect(z.resistance).toBeCloseTo(reference.expected.resistanceOhm, 1);
    expect(z.reactance).toBeCloseTo(reference.expected.reactanceOhm, 1);
    expect(gain).toBeCloseTo(reference.expected.gainDbi, 1);
    expect(gain).toBeGreaterThan(5.0);
    expect(gain).toBeLessThan(5.3);
    expect(takeOff).toBe(reference.expected.takeOffAngleDeg);
    expect(azimuthVariation).toBeLessThan(0.001);
    await expect(page.getByTestId("elevation-angle-inspector-source-vertical-current")).toHaveText("Exact NEC sample");
    await page.getByTestId("elevation-angle-inspector-input").fill("175");
    await expect(page.getByTestId("elevation-angle-inspector-source-vertical-current")).toHaveText("Exact NEC sample");
    await expect(page.getByTestId("elevation-angle-inspector-input")).toHaveValue("175");
    await expect(page.getByTestId("elevation-angle-inspector-gain-vertical-current")).toContainText("dBi");
  }
  await page.getByTestId("vertical-pattern-mode").click();
  await expect(page.getByTestId("vertical-pattern-mode")).toHaveText("Relative pattern (dB)");
  await expect(page.getByTestId("elevation-angle-inspector-gain-vertical-current")).toContainText("dB relative to cut peak");
  await expect(page.getByTestId("elevation-angle-inspector-context-vertical-current")).toHaveText("Cut peak is 0.00 dB in this view");
});

test("explicit radial count, length, angle, and height regenerate geometry and solve", async ({ page }) => {
  await openVerticals(page);
  for (const radialCount of [3, 4, 8]) {
    await page.getByTestId("vertical-radial-count").fill(String(radialCount));
    await expect(page.getByTestId("vertical-wire-count")).toHaveText(String(radialCount + 1));
    await runAndWait(page);
    await expect(page.getByTestId("vertical-current-distribution"), `${radialCount} radials`).toBeVisible();
    await expect(page.getByTestId("radial-current-path"), `${radialCount} radials`).toBeVisible();
  }
  await page.getByTestId("vertical-radial-angle").fill("10");
  await page.getByTestId("vertical-radial-length").fill("4.8");
  await page.getByTestId("vertical-base-height").fill("3.2");
  await expect(page.getByTestId("vertical-dimension-mode")).toHaveText("Manual dimensions");
  await expect(page.getByTestId("vertical-errors")).toHaveCount(0);
  await runAndWait(page);
});

test("Sommerfeld/Norton explicit wires and simplified RCA screen remain distinct", async ({ page }) => {
  await openVerticals(page);
  await page.getByTestId("vertical-ground-kind").selectOption("sommerfeld-norton");
  await page.getByTestId("vertical-conductivity").fill("0.001");
  await page.getByTestId("vertical-permittivity").fill("4");
  await expect(page.getByTestId("vertical-ground-explanation")).toContainText("Sommerfeld/Norton");
  expect(await page.getByTestId("vertical-generated-nec").textContent()).toContain("GN 2 0 0 0 4 0.001");
  await runAndWait(page);

  await page.getByTestId("vertical-mode-nec-radial-screen-approximation").click();
  await expect(page.getByTestId("vertical-ground-explanation")).toContainText("It is not Sommerfeld/Norton");
  await expect(page.getByTestId("vertical-wire-count")).toHaveText("1");
  await expect(page.getByTestId("vertical-warnings")).toContainText("not explicit current-carrying wires");
  const screenDeck = await page.getByTestId("vertical-generated-nec").textContent() ?? "";
  expect(screenDeck).toContain("GN 0 16");
  expect(screenDeck).toContain("RP 4 19 72");
  await runAndWait(page);
  await expect(page.getByTestId("radial-current-path")).toHaveCount(0);
});

test("ground-mounted real-soil radials solve the externally compared exact deck", async ({ page }) => {
  await openVerticals(page);
  await page.getByTestId("vertical-mode-ground-mounted-explicit-radials").click();
  await expect(page.getByTestId("vertical-radiator-diameter")).toHaveValue("1");
  await expect(page.getByTestId("vertical-radial-diameter")).toHaveValue("1");
  await page.getByTestId("vertical-radiator-diameter").fill("2");
  await page.getByTestId("vertical-radial-diameter").fill("2");
  await expect(page.getByTestId("vertical-wire-count")).toHaveText("17");
  await expect(page.getByTestId("vertical-ground-kind")).toHaveValue("sommerfeld-norton");
  await expect(page.getByTestId("vertical-surface-clearance")).toHaveValue("10");
  await expect(page.getByTestId("vertical-warnings")).toContainText("cannot solve buried or exactly-on-soil wires");
  const deck = await page.getByTestId("vertical-generated-nec").textContent() ?? "";
  expect(deck).toContain("CM HF Antenna Studio vertical system: ground-mounted-explicit-radials");
  expect(deck).toContain("GE -1\nGN 2 0 0 0 13 0.005");
  expect(deck).toContain("0.001");
  await runAndWait(page);
  const z = await impedance(page.getByTestId("vertical-result-impedance"));
  expect(z.resistance).toBeCloseTo(32.3154, 1);
  expect(z.reactance).toBeCloseTo(-15.3840, 1);
  expect(numericResult(await page.getByTestId("vertical-result-gain").innerText())).toBeCloseTo(-0.16, 1);
  expect(numericResult(await page.getByTestId("vertical-result-takeoff").innerText())).toBe(25);
  await expect(page.getByTestId("vertical-current-distribution")).toBeVisible();
  await expect(page.getByTestId("radial-current-path")).toBeVisible();
});

test("the NEC-2 User's Guide Example 10 dimensions solve as an explicit-wire analogue", async ({ page }) => {
  await openVerticals(page);
  await page.getByTestId("vertical-frequency").fill("10");
  await page.getByTestId("vertical-radiator-length").fill("7.5");
  await page.getByTestId("vertical-radiator-diameter").fill("6");
  await page.getByTestId("vertical-base-height").fill("0.01");
  await page.getByTestId("vertical-radial-count").fill("6");
  await page.getByTestId("vertical-radial-length").fill("30");
  await page.getByTestId("vertical-radial-diameter").fill("6");
  await page.getByTestId("vertical-radial-angle").fill("0");
  await page.getByTestId("vertical-ground-kind").selectOption("sommerfeld-norton");
  await page.getByTestId("vertical-conductivity").fill("0.001");
  await page.getByTestId("vertical-permittivity").fill("4");
  await expect(page.getByTestId("vertical-errors")).toHaveCount(0);
  await expect(page.getByTestId("vertical-warnings")).toContainText("0.001λ");
  await expect(page.getByTestId("vertical-wire-count")).toHaveText("7");
  await runAndWait(page);
  const z = await impedance(page.getByTestId("vertical-result-impedance"));
  expect(Number.isFinite(z.resistance) && Number.isFinite(z.reactance)).toBe(true);
});

test("validity checks block ground penetration and excessive exact values", async ({ page }) => {
  await openVerticals(page);
  await page.getByTestId("vertical-base-height").fill("0.2");
  await page.getByTestId("vertical-radial-length").fill("5");
  await page.getByTestId("vertical-radial-angle").fill("45");
  await expect(page.getByTestId("vertical-errors")).toContainText("must remain above z = 0");
  await expect(page.getByTestId("run-vertical-nec")).toBeDisabled();
  await expect(page.getByTestId("vertical-generated-nec")).toContainText("Resolve validity errors");

  await page.getByTestId("vertical-radiator-length").fill("100");
  await expect(page.getByTestId("vertical-radiator-length")).toHaveValue("100");
  await expect(page.getByTestId("vertical-errors")).toContainText("between 0.2 and 60");
});

test("units and reference impedance affect display/derived SWR without changing NEC geometry", async ({ page }) => {
  await openVerticals(page);
  const deckBefore = await page.getByTestId("vertical-generated-nec").textContent();
  const metricLength = Number(await page.getByTestId("vertical-radiator-length").inputValue());
  await page.getByTestId("vertical-units").click();
  const imperialLength = Number(await page.getByTestId("vertical-radiator-length").inputValue());
  expect(imperialLength).toBeCloseTo(metricLength / 0.3048, 2);
  expect(await page.getByTestId("vertical-generated-nec").textContent()).toBe(deckBefore);
  await runAndWait(page);
  const swr50 = await page.getByTestId("vertical-result-swr").innerText();
  await page.getByTestId("vertical-reference-impedance").selectOption("75");
  await runAndWait(page);
  expect(await page.getByTestId("vertical-result-swr").innerText()).not.toBe(swr50);
});

test("workbench remains usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openVerticals(page);
  await expect(page.getByRole("heading", { name: "Vertical antennas" })).toBeVisible();
  await expect(page.getByTestId("vertical-mode-elevated-explicit-radials")).toBeVisible();
  await expect(page.getByTestId("vertical-radial-count-slider")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("representative vertical calculations emit no browser errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await openVerticals(page);
  await runAndWait(page);
  await page.getByTestId("vertical-mode-nec-radial-screen-approximation").click();
  await runAndWait(page);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
