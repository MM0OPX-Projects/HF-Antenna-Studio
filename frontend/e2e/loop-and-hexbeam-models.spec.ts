import { expect, test, type Locator, type Page } from "@playwright/test";
import { LOOP_BEAM_PERFECT_GROUND_REGRESSION_CASES } from "../src/features/loop-beams/validation-cases";

async function openLab(page: Page) { await page.goto("/loop-and-hexbeam-models"); const changelog = page.getByRole("button", { name: "Got it" }); if (await changelog.isVisible().catch(() => false)) await changelog.click(); if ((page.viewportSize()?.width ?? 1280) >= 768) await page.getByLabel("Global antenna wire material").selectOption("perfect"); }
async function waitForSolved(page: Page) { await expect(page.getByTestId("loop-results")).toBeVisible({ timeout: 30_000 }); await expect(page.getByTestId("loop-solver-error")).toHaveCount(0); }
function numeric(text: string): number { return Number(text.match(/[+−-]?\d+(?:\.\d+)?/)![0].replace("−", "-")); }
async function impedance(locator: Locator) { const text = (await locator.innerText()).replace("−", "-"); const match = text.match(/^([+-]?\d+(?:\.\d+)?)\s+([+-])\s+j(\d+(?:\.\d+)?)/); if (!match) throw new Error(`Could not parse impedance: ${text}`); return { resistance: Number(match[1]), reactance: Number(match[3]) * (match[2] === "-" ? -1 : 1) }; }

test("five perfect-ground reference families reproduce independent NEC-2D results", async ({ page }) => {
  await openLab(page);
  await expect(page.getByTestId("loop-wire-diameter")).toHaveValue("1");
  for (const reference of LOOP_BEAM_PERFECT_GROUND_REGRESSION_CASES) {
    await page.getByTestId(`loop-type-${reference.kind}`).click(); await page.getByTestId("loop-wire-diameter").fill("2"); await expect(page.getByTestId("loop-results")).toHaveCount(0); await expect(page.getByTestId("loop-generated-nec")).toContainText("0.001"); await page.getByTestId("loop-ground").selectOption("perfect");
    await expect(page.getByTestId("loop-errors"), reference.kind).toHaveCount(0); await expect(page.getByTestId("loop-generated-nec")).toContainText("GE 1\nGN 1"); await waitForSolved(page);
    const z = await impedance(page.getByTestId("loop-result-impedance")); expect(z.resistance, reference.kind).toBeCloseTo(reference.expected.resistanceOhm, 1); expect(z.reactance, reference.kind).toBeCloseTo(reference.expected.reactanceOhm, 1); expect(numeric(await page.getByTestId("loop-result-gain").innerText()), reference.kind).toBeCloseTo(reference.expected.peakGainDbi, 1); expect(numeric(await page.getByTestId("loop-result-takeoff").innerText()), reference.kind).toBe(reference.expected.takeOffAngleDeg); await page.getByTestId("elevation-angle-inspector-input").fill("5"); await expect(page.getByTestId("elevation-angle-inspector-source-current")).toContainText("Interpolated between 4.0° and 6.0° NEC samples"); await page.getByTestId("elevation-angle-inspector-input").fill("175"); await expect(page.getByTestId("elevation-angle-inspector-source-current")).toContainText("Interpolated between 174.0° and 176.0° NEC samples"); await expect(page.getByTestId("loop-beam-current-distribution")).toBeVisible(); await expect(page.getByTestId("radiation-pattern-3d").locator("canvas")).toBeVisible();
  }
});

test("delta feed choices alter exact source geometry and derived orientation without naming polarisation", async ({ page }) => {
  await openLab(page); await page.getByTestId("loop-type-delta-loop").click(); await expect(page.getByTestId("feed-conductor-orientation")).toHaveText("horizontal"); const bottomDeck = await page.getByTestId("loop-generated-nec").textContent();
  await page.getByTestId("delta-feed-location").selectOption("lower-corner"); await expect(page.getByTestId("feed-conductor-orientation")).toHaveText("sloping"); expect(await page.getByTestId("loop-generated-nec").textContent()).not.toBe(bottomDeck); await waitForSolved(page);
  await page.getByTestId("delta-feed-location").selectOption("side-region"); await expect(page.getByTestId("feed-conductor-orientation")).toHaveText("sloping"); await waitForSolved(page); await expect(page.getByText(/not a polarisation claim/i)).toBeVisible();
});

test("four-element quad and every hex construction-band preset regenerate connected wire paths", async ({ page }) => {
  await openLab(page); await page.getByTestId("loop-type-cubical-quad").click(); await page.getByTestId("quad-loop-count").selectOption("4"); await expect(page.getByTestId("loop-wire-count")).toHaveText("18"); await expect(page.getByTestId("loop-errors")).toHaveCount(0); await waitForSolved(page); await expect(page.getByTestId("loop-result-fb")).toBeVisible();
  await page.getByTestId("loop-type-hexbeam").click();
  for (const band of ["20m", "17m", "15m", "12m", "10m"]) { await page.getByTestId("hex-band").selectOption(band); await expect(page.getByTestId("loop-wire-count"), band).toHaveText("10"); await expect(page.getByTestId("loop-errors"), band).toHaveCount(0); expect((await page.getByTestId("loop-generated-nec").textContent())?.match(/^GW /gm), band).toHaveLength(10); await expect(page.getByTestId("hex-frame-radius"), band).toContainText("m"); }
  await waitForSolved(page);
  await page.getByTestId("loop-pattern-mode").click();
  await expect(page.getByTestId("loop-pattern-mode")).toHaveText("Relative pattern (dB)");
  await expect(page.getByTestId("elevation-angle-inspector-gain-current")).toContainText("dB relative to cut peak");
  await expect(page.getByTestId("elevation-angle-inspector-context-current")).toHaveText("Cut peak is 0.00 dB in this view");
});

test("rapid edits withhold stale patterns until the latest exact model solves", async ({ page }) => {
  await openLab(page); await waitForSolved(page); const geometry = page.getByTestId("loop-beam-geometry-3d"); const before = await geometry.getAttribute("data-model-key"); await page.getByTestId("square-height").fill("7"); await page.getByTestId("square-height").fill("9"); await page.getByTestId("square-side").fill("5.2"); await expect(page.getByTestId("loop-results")).toHaveCount(0); await expect(page.getByTestId("loop-calculation-status")).toContainText("waiting for stable input"); expect(await geometry.getAttribute("data-model-key")).not.toBe(before); await waitForSolved(page); await expect(page.getByTestId("loop-calculation-status")).toContainText("Calculation complete");
});

test("keyboard, mobile layout, ground controls, and browser console remain clean", async ({ page }) => {
  const consoleErrors: string[] = [], pageErrors: string[] = []; page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); }); page.on("pageerror", (error) => pageErrors.push(error.message)); await page.setViewportSize({ width: 390, height: 844 }); await openLab(page); await expect(page.getByRole("heading", { name: "Loop, cubical-quad and hexbeam models" })).toBeVisible(); await page.getByTestId("square-side-slider").focus(); const before = Number(await page.getByTestId("square-side-slider").inputValue()); await page.getByTestId("square-side-slider").press("ArrowRight"); expect(Number(await page.getByTestId("square-side-slider").inputValue())).toBeGreaterThan(before); await page.getByTestId("loop-ground").selectOption("sommerfeld-norton"); await page.getByTestId("loop-conductivity").fill("0.001"); await page.getByTestId("loop-permittivity").fill("4"); await expect(page.getByTestId("loop-generated-nec")).toContainText("GN 2 0 0 0 4 0.001"); await waitForSolved(page); expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1); expect(consoleErrors).toEqual([]); expect(pageErrors).toEqual([]);
});
