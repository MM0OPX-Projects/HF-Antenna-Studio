import { expect, test } from "@playwright/test";
import {
  DIPOLE_REGRESSION_CASES,
  PUBLISHED_NEC_REFERENCE,
  VALIDATION_DIPOLE_LENGTH_M,
  VALIDATION_FREQUENCY_MHZ,
  VALIDATION_WIRE_DIAMETER_MM,
} from "../src/features/verified-dipole/validation-cases";

function numberFrom(text: string): number {
  const match = text.match(/[+-]?\d+(?:\.\d+)?/);
  if (!match) throw new Error(`No number found in ${JSON.stringify(text)}`);
  return Number(match[0]);
}

test("five reference geometries remain within recorded nec2c/WASM envelopes", async ({ page }) => {
  await page.goto("/verified-dipole");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();

  await page.getByTestId("frequency-mhz").fill(String(VALIDATION_FREQUENCY_MHZ));
  await page.getByTestId("dipole-length").fill(String(VALIDATION_DIPOLE_LENGTH_M));
  await page.getByTestId("wire-diameter").fill(String(VALIDATION_WIRE_DIAMETER_MM));

  for (const reference of DIPOLE_REGRESSION_CASES) {
    await page.getByTestId("dipole-height").fill(String(reference.heightM));
    await page.getByTestId("ground-kind").selectOption(reference.ground);
    await page.getByTestId("run-dipole").click();
    await expect(page.getByTestId("dipole-results"), reference.id).toBeVisible({ timeout: 30_000 });

    const resistance = numberFrom(await page.getByTestId("result-resistance").innerText());
    const reactance = numberFrom(await page.getByTestId("result-reactance").innerText());
    const gain = numberFrom(await page.getByTestId("result-gain").innerText());
    expect(resistance, `${reference.id} resistance`).toBeCloseTo(reference.expected.resistanceOhm, 1);
    expect(reactance, `${reference.id} reactance`).toBeCloseTo(reference.expected.reactanceOhm, 1);
    expect(gain, `${reference.id} gain`).toBeCloseTo(reference.expected.maximumGainDbi, 1);

    const takeOffText = await page.getByTestId("result-takeoff").innerText();
    if (reference.expected.takeOffAngleDeg === null) {
      expect(takeOffText).toContain("N/A");
    } else {
      expect(numberFrom(takeOffText), `${reference.id} take-off angle`).toBeCloseTo(reference.expected.takeOffAngleDeg, 1);
    }
  }
});

test("matches the published 38 MHz NEC-2 dipole reference within declared tolerance", async ({ page }) => {
  const reference = PUBLISHED_NEC_REFERENCE;
  await page.goto("/verified-dipole");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await page.getByTestId("frequency-mhz").fill(String(reference.frequencyMhz));
  await page.getByTestId("dipole-length").fill(String(reference.totalLengthM));
  await page.getByTestId("wire-diameter").fill(String(reference.wireDiameterMm));
  await page.getByTestId("dipole-height").fill("0");
  await page.getByTestId("ground-kind").selectOption("free-space");
  await expect(page.getByTestId("segment-count")).toHaveText(String(reference.applicationSegments));
  await page.getByTestId("run-dipole").click();
  await expect(page.getByTestId("dipole-results")).toBeVisible({ timeout: 30_000 });

  const resistance = numberFrom(await page.getByTestId("result-resistance").innerText());
  const reactance = numberFrom(await page.getByTestId("result-reactance").innerText());
  const gain = numberFrom(await page.getByTestId("result-gain").innerText());
  expect(Math.abs(resistance - reference.expected.resistanceOhm)).toBeLessThanOrEqual(reference.tolerance.impedanceOhm);
  expect(Math.abs(reactance - reference.expected.reactanceOhm)).toBeLessThanOrEqual(reference.tolerance.impedanceOhm);
  expect(Math.abs(gain - reference.expected.maximumGainDbi)).toBeLessThanOrEqual(reference.tolerance.gainDb);
});
