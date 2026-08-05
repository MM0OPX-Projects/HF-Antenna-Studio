import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function openAnalyser(page: Page) {
  await page.goto("/frequency-analyser");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
}

async function runSweep(page: Page, points = 11) {
  await page.getByTestId("sweep-points").fill(String(points));
  await page.getByTestId("run-sweep").click();
  await expect(page.getByTestId("sweep-status")).toContainText(`${points} points`, { timeout: 60_000 });
  await expect(page.getByTestId("analyser-chart")).toBeVisible();
}

test("a real impedance-only NEC batch drives all analyser measurements", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openAnalyser(page);
  await runSweep(page);
  await expect(page.getByText(/Complex impedance:/)).toBeVisible();
  for (const metric of ["R", "X", "|Z|", "Return loss", "|Γ|", "SWR"]) {
    await page.getByRole("button", { name: metric, exact: true }).click();
    await expect(page.getByTestId("analyser-chart")).toBeVisible();
  }
  await page.getByLabel("Cursor frequency point").fill("10");
  await expect(page.getByText("14.350000 MHz · Z₀ 50 Ω")).toBeVisible();
  const before = await page.getByText(/Complex impedance:/).textContent();
  await page.getByRole("button", { name: "75 Ω" }).click();
  await expect(page.getByText("14.350000 MHz · Z₀ 75 Ω")).toBeVisible();
  expect(await page.getByText(/Complex impedance:/).textContent()).toContain(before!.split("·")[0]!.trim());
  await page.getByText("Optional Smith chart").click();
  await expect(page.getByText("Normalized to 75 ohm")).toBeVisible();
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("centre/span, overlays and all export formats remain reproducible", async ({ page }) => {
  await openAnalyser(page);
  await page.getByRole("button", { name: "Centre / span" }).click();
  await page.getByTestId("sweep-centre").fill("7.1");
  await page.getByTestId("sweep-span").fill("0.2");
  await runSweep(page, 9);
  await page.getByRole("button", { name: "Save current sweep" }).click();
  await expect(page.getByText("1/4")).toBeVisible();
  await page.getByTestId("sweep-centre").fill("14.175");
  await page.getByTestId("sweep-span").fill("0.35");
  await runSweep(page, 9);
  await expect(page.locator('[data-testid="analyser-chart"] .recharts-line')).toHaveCount(2);

  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toBe("hf-antenna-studio-sweeps.csv");
  expect(await readFile(await csv.path() as string, "utf8")).toContain("reflection_magnitude");

  const projectDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export project data" }).click();
  const project = await projectDownload;
  const data = JSON.parse(await readFile(await project.path() as string, "utf8"));
  expect(data.format).toBe("hf-antenna-studio-frequency-analyser");
  expect(data.antennaSnapshot.wires.length).toBeGreaterThan(0);
  expect(data.savedSweeps).toHaveLength(1);

  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toBe("hf-antenna-studio-analyser.png");
  expect((await readFile(await png.path() as string)).length).toBeGreaterThan(1_000);
});

test("cancelling a long sweep keeps the UI responsive and publishes no partial result", async ({ page }) => {
  await openAnalyser(page);
  await page.getByTestId("sweep-start").fill("1.8");
  await page.getByTestId("sweep-stop").fill("54");
  await page.getByTestId("sweep-points").fill("401");
  await page.getByTestId("run-sweep").click();
  await expect(page.getByTestId("cancel-sweep")).toBeVisible();
  await page.getByTestId("cancel-sweep").click();
  await expect(page.getByTestId("sweep-status")).toContainText("cancelled");
  await expect(page.getByTestId("analyser-chart")).toHaveCount(0);
  await expect(page.getByTestId("run-sweep")).toBeEnabled();
});
