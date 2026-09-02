import { expect, test } from "@playwright/test";

const isWindowsCi = process.platform === "win32" && Boolean(process.env.CI);
const heightTestTimeoutMs = isWindowsCi ? 720_000 : 120_000;
const heightResultTimeoutMs = isWindowsCi ? 600_000 : 30_000;

const HEIGHT_REFERENCES = [
  { height: "0.1", gainDbi: 8.83, takeOffDeg: 90, lowAngleGainDbi: -23.14 },
  { height: "0.25", gainDbi: 7.49, takeOffDeg: 90, lowAngleGainDbi: -21.23 },
  { height: "0.5", gainDbi: 8.43, takeOffDeg: 30, lowAngleGainDbi: 2.73 },
  { height: "1", gainDbi: 8.23, takeOffDeg: 15, lowAngleGainDbi: 7.21 },
  { height: "2", gainDbi: 8.14, takeOffDeg: 60, lowAngleGainDbi: 7.18 },
] as const;

function numberFrom(text: string): number {
  const match = text.match(/[+-]?\d+(?:\.\d+)?/);
  if (!match) throw new Error(`No number found in ${JSON.stringify(text)}`);
  return Number(match[0]);
}

for (const reference of HEIGHT_REFERENCES) {
  test(`${reference.height} wavelength perfect-ground case matches its recorded nec2c envelope`, async ({ page }) => {
    test.setTimeout(heightTestTimeoutMs);
    await page.goto("/dipole-height-lab");
    const changelog = page.getByRole("button", { name: "Got it" });
    if (await changelog.isVisible().catch(() => false)) await changelog.click();

    await page.getByTestId(`height-preset-${reference.height}`).click();
    await expect(page.getByTestId("height-results"), `${reference.height}λ result`).toBeVisible({ timeout: heightResultTimeoutMs });
    const gain = numberFrom(await page.getByTestId("height-result-gain").innerText());
    const takeOff = numberFrom(await page.getByTestId("height-result-takeoff").innerText());
    const lowAngleGain = numberFrom(await page.getByTestId("height-result-low-gain").innerText());
    expect(gain, `${reference.height}λ gain`).toBeCloseTo(reference.gainDbi, 1);
    expect(takeOff, `${reference.height}λ take-off`).toBeCloseTo(reference.takeOffDeg, 1);
    expect(lowAngleGain, `${reference.height}λ low-angle gain`).toBeCloseTo(reference.lowAngleGainDbi, 1);
    await expect(page.getByTestId("polar-series-elevation-current")).toHaveAttribute("d", /^(?!.*NaN).+$/);
    await expect(page.getByTestId("polar-series-azimuth-current")).toHaveAttribute("d", /^(?!.*NaN).+$/);
  });
}
