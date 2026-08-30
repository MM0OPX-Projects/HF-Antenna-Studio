import { expect, test, type Page } from "@playwright/test";

type Baseline = {
  template: RegExp | null;
  swr: [number, number];
  resistance: [number, number];
  reactance: [number, number];
  gain: [number, number];
};

const BASELINES: Record<string, Baseline> = {
  dipole: {
    template: null,
    swr: [1.35, 1.5],
    resistance: [69, 73],
    reactance: [-4, 1],
    gain: [7.0, 7.4],
  },
  vertical: {
    template: /Vertical Quarter-wave/i,
    swr: [1.35, 1.6],
    resistance: [32, 36],
    reactance: [0, 6],
    gain: [-0.3, 0.3],
  },
  yagi: {
    template: /Yagi High-gain directional beam/i,
    swr: [1.8, 2.2],
    resistance: [23, 28],
    reactance: [-6, 1],
    gain: [12.3, 13.0],
  },
};

const isWindowsCi = process.platform === "win32" && Boolean(process.env.CI);
const baselineTestTimeoutMs = isWindowsCi ? 720_000 : 120_000;
const baselineResultTimeoutMs = isWindowsCi ? 600_000 : 120_000;

function between(value: number, [minimum, maximum]: [number, number]): boolean {
  return value >= minimum && value <= maximum;
}

function readSummary(body: string) {
  const swr = body.match(/SWR\s+([+-]?\d+(?:\.\d+)?)/i);
  const gain = body.match(/Gain\s+([+-]?\d+(?:\.\d+)?)\s*dBi/i);
  const impedance = body.match(/Impedance\s+([+-]?\d+(?:\.\d+)?)\s*([+-])\s*j\s*([+-]?\d+(?:\.\d+)?)\s*Ω/i);

  if (!swr || !gain || !impedance) {
    throw new Error("Could not parse SWR, gain, and impedance from the results summary");
  }

  return {
    swr: Number(swr[1]),
    gain: Number(gain[1]),
    resistance: Number(impedance[1]),
    reactance: Number(impedance[3]) * (impedance[2] === "-" ? -1 : 1),
  };
}

async function dismissChangelog(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Got it" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function configureBoundedBaselineRequest(page: Page): Promise<void> {
  // Keep the sample's complete 21-point impedance sweep. Only select the
  // public 10° pattern option; dedicated pattern suites cover finer grids.
  await page.getByLabel("Radiation pattern angular resolution").selectOption("10");
}

async function waitForBaselineResult(page: Page): Promise<void> {
  const result = page.getByText(/freq pts/i);
  const solverError = page.locator('p[role="alert"]');
  const outcome = await Promise.race([
    result.waitFor({ state: "visible", timeout: baselineResultTimeoutMs }).then(() => null),
    solverError.waitFor({ state: "visible", timeout: baselineResultTimeoutMs }).then(() => solverError.innerText()),
  ]);

  if (outcome) throw new Error(`Simulation failed before publishing the baseline result: ${outcome}`);
}

for (const [name, baseline] of Object.entries(BASELINES)) {
  test(`${name} example calculates within the recorded regression envelope`, async ({ page }) => {
    test.setTimeout(baselineTestTimeoutMs);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/");
    await dismissChangelog(page);

    if (baseline.template) {
      await page.getByRole("button", { name: /Dipole.*Change/i }).click();
      await page.getByRole("button", { name: baseline.template }).click();
    }

    await configureBoundedBaselineRequest(page);
    await page.getByRole("button", { name: /Run Simulation/i }).click();
    await waitForBaselineResult(page);

    const summary = readSummary(await page.locator("body").innerText());
    expect(between(summary.swr, baseline.swr), `SWR ${summary.swr}`).toBeTruthy();
    expect(between(summary.resistance, baseline.resistance), `R ${summary.resistance}`).toBeTruthy();
    expect(between(summary.reactance, baseline.reactance), `X ${summary.reactance}`).toBeTruthy();
    expect(between(summary.gain, baseline.gain), `gain ${summary.gain}`).toBeTruthy();

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    const bounds = await canvas.boundingBox();
    expect(bounds?.width ?? 0).toBeGreaterThan(100);
    expect(bounds?.height ?? 0).toBeGreaterThan(100);

    await page.getByRole("tab", { name: "Pattern", exact: true }).click();
    await expect(page.getByText("Radiation Pattern")).toBeVisible();
    await expect(page.getByTestId("results-radiation-cuts-azimuth")).toBeVisible();
    await expect(page.getByTestId("elevation-angle-inspector-input")).toHaveValue("5");
    await expect(page.getByTestId("elevation-angle-inspector")).toContainText("No valid pattern samples bracket this angle");
    await page.getByTestId("elevation-angle-inspector-input").fill("10");
    await expect(page.locator('[data-testid^="elevation-angle-inspector-source-"]').filter({ hasText: "Exact NEC sample" }).first()).toBeVisible();
    await page.getByTestId("elevation-angle-inspector-input").fill("175");
    // The exact-horizon NEC sample is invalid for these grounded 10° grids,
    // so the UI must not invent a 175° interpolation across that sentinel.
    await expect(page.getByTestId("elevation-angle-inspector")).toContainText("No valid pattern samples bracket this angle");
    await page.getByTestId("elevation-angle-inspector-input").fill("170");
    await expect(page.locator('[data-testid^="elevation-angle-inspector-source-"]').filter({ hasText: "Exact NEC sample" }).first()).toBeVisible();
    const elevationPlot = page.getByRole("img", { name: /elevation polar radiation pattern.*interactive angle cursor/i });
    const elevationBounds = await elevationPlot.boundingBox();
    expect(elevationBounds).not.toBeNull();
    await page.mouse.move(elevationBounds!.x + elevationBounds!.width * 0.82, elevationBounds!.y + elevationBounds!.height / 2);
    await page.mouse.down();
    await page.mouse.move(elevationBounds!.x + elevationBounds!.width / 2, elevationBounds!.y + elevationBounds!.height * 0.18, { steps: 6 });
    await expect.poll(async () => Number(await page.getByTestId("elevation-angle-inspector-input").inputValue())).toBeGreaterThan(80);
    await page.mouse.up();

    await page.getByRole("tab", { name: "Z", exact: true }).click();
    await expect(page.getByText("Impedance vs Frequency")).toBeVisible();

    expect(consoleErrors, "browser console errors").toEqual([]);
    expect(pageErrors, "uncaught page errors").toEqual([]);
  });
}
