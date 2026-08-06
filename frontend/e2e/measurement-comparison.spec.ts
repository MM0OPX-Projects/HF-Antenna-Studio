import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const TOUCHSTONE = [
  "! NanoVNA-style S11 export retained verbatim",
  "# MHz S RI R 50",
  "14.0000 0.10 -0.10",
  "14.0875 0.05 -0.05",
  "14.1750 0.00 0.00",
  "14.2625 -0.05 0.05",
  "14.3500 -0.10 0.10",
  "",
].join("\r\n");

async function openPage(page: Page): Promise<void> {
  await page.goto("/measurement-comparison");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await expect(page.getByRole("heading", { name: "Measurement Comparison" })).toBeVisible();
}

async function importMeasurement(page: Page): Promise<void> {
  await page.getByTestId("measurement-file").setInputFiles({ name: "nanovna-antenna.s1p", mimeType: "text/plain", buffer: Buffer.from(TOUCHSTONE) });
  await expect(page.getByTestId("measurement-summary")).toContainText("5 original points");
}

test("measured Touchstone S11 overlays a real local NEC sweep with explicit source labels", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await openPage(page);
  await importMeasurement(page);
  await page.getByRole("button", { name: "Use measurement range" }).click();
  await expect(page.getByTestId("comparison-points")).toHaveValue("5");
  await page.getByTestId("run-comparison-simulation").click();
  await expect(page.getByTestId("comparison-status")).toContainText("SIMULATION complete", { timeout: 120_000 });
  await expect(page.getByTestId("measurement-overlay-chart")).toBeVisible();
  await expect(page.getByTestId("measurement-difference-chart")).toBeVisible();
  await expect(page.getByTestId("alignment-label")).toContainText("5/5 measured points aligned");
  await expect(page.getByTestId("measurement-overlay-chart").locator(".recharts-line")).toHaveCount(2);
  await expect(page.getByTestId("comparison-table").locator("tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "R", exact: true }).click();
  await expect(page.getByText("Difference: MEASUREMENT − SIMULATION")).toBeVisible();

  const csvDownload = page.waitForEvent("download");
  await page.getByTestId("export-comparison-csv").click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toBe("hf-antenna-studio-measurement-comparison.csv");
  const exportedCsv = await readFile(await csv.path() as string, "utf8");
  expect(exportedCsv).toContain("measurement_minus_simulation_r_ohms");
  expect(exportedCsv).toContain('"exact"');

  const projectDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export project data" }).click();
  const project = JSON.parse(await readFile(await (await projectDownload).path() as string, "utf8"));
  expect(project.measurement.sourceText).toBe(TOUCHSTONE);
  expect(project.measurement.points[0].rawLine).toBe("14.0000 0.10 -0.10");
  expect(project.comparison.alignmentLabel).toContain("original measurement frequencies");
  expect(browserErrors).toEqual([]);
});

test("unsafe or ambiguous measurement inputs fail closed without repaired data", async ({ page }) => {
  await openPage(page);
  await page.getByTestId("measurement-file").setInputFiles({ name: "nanovna.csv", mimeType: "text/csv", buffer: Buffer.from("frequency,swr\n14000000,1.2\n") });
  await expect(page.getByTestId("comparison-status")).toContainText("NanoVNA CSV dialects are not imported");
  await page.getByTestId("measurement-file").setInputFiles({ name: "unordered.s1p", mimeType: "text/plain", buffer: Buffer.from("# MHz S RI R 50\n14.2 0 0\n14.1 0 0\n") });
  await expect(page.getByTestId("comparison-status")).toContainText("strictly increasing");
  await expect(page.getByTestId("run-comparison-simulation")).toBeDisabled();
});

test("alignment choices, cancellation and narrow layout remain explicit and responsive", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page);
  await importMeasurement(page);
  await page.getByTestId("comparison-alignment").selectOption("exact");
  await expect(page.getByTestId("comparison-alignment")).toHaveValue("exact");
  await page.getByTestId("comparison-start").fill("1.8");
  await page.getByTestId("comparison-stop").fill("54");
  await page.getByTestId("comparison-points").fill("401");
  await page.getByTestId("run-comparison-simulation").click();
  await expect(page.getByTestId("cancel-comparison-simulation")).toBeVisible();
  await page.getByTestId("cancel-comparison-simulation").click();
  await expect(page.getByTestId("comparison-status")).toContainText("cancelled");
  await expect(page.getByTestId("measurement-overlay-chart")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
