import { expect, test, type Page } from "@playwright/test";

const DIPOLE = [
  "CM wire editor supported dipole",
  "CE",
  "GW 1 21 -5.32 0 10 5.32 0 10 0.001",
  "GE 0",
  "GN -1",
  "LD 4 1 1 1 0 0 0",
  "EX 0 1 11 0 1 0",
  "FR 0 3 0 0 14.0 0.1",
  "RP 0 37 72 1000 -90 0 5 5",
  "EN",
  "",
].join("\r\n");

const UNSUPPORTED_ARC = "CM unsupported arc\r\nCE\r\nGA 9 21 5 0 180 .001\r\nGE 0\r\nGN -1\r\nFR 0 1 0 0 14.1 0\r\nEN\r\n";

async function dismissChangelog(page: Page) {
  const button = page.getByRole("button", { name: "Got it" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function openImport(page: Page) {
  await page.locator("aside select").first().selectOption("tools");
  await page.getByRole("button", { name: "Import / Export" }).click();
}

test("newly drawn editor wires default to 1 mm diameter", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  await page.locator("aside select").first().selectOption("wires");
  await page.locator("aside").getByTitle("Add new wire").first().click();
  await page.locator("aside").getByRole("row", { name: "Wire 1" }).first().click();
  await expect(page.locator('aside [data-testid="wire-properties-diameter"]:visible')).toContainText("1.000");
  await expect(page.locator('aside [data-testid="wire-properties-diameter"]:visible')).toContainText("mm");
});

test("supported NEC import reaches the real solver, results, and 3D editor without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/editor");
  await dismissChangelog(page);
  await openImport(page);
  await page.locator('input[type="file"][accept*=".nec"]').setInputFiles({
    name: "supported-dipole.nec",
    mimeType: "text/plain",
    buffer: Buffer.from(DIPOLE),
  });

  const report = page.getByTestId("nec-import-report");
  await expect(report).toContainText("structured");
  await expect(report).toContainText("represented: 6");
  await expect(report).toContainText("The visible model still matches");
  await expect(page.locator("canvas").first()).toBeVisible();

  await page.locator("aside select").first().selectOption("settings");
  await expect(page.locator("aside").getByLabel("Geometry/ground connection (NEC GE)")).toHaveValue("0");

  await page.locator("aside select").first().selectOption("wires");
  const objectList = page.locator("aside").getByTestId("antenna-object-list");
  await expect(objectList).toBeVisible();
  await objectList.locator("tbody tr").first().click();
  await expect(page.locator("aside").getByTestId("wire-load-editor")).toContainText("Fixed impedance");

  await page.locator("aside select").first().selectOption("tools");
  await expect(page.locator("aside").getByTestId("wire-transform-panel")).toBeVisible();
  await page.locator("aside").getByRole("button", { name: "Rotate selection" }).click();
  await page.getByRole("button", { name: /Undo/ }).first().click();

  await page.getByRole("button", { name: "Run Simulation" }).click();
  await expect(page.locator("aside").getByTestId("wire-editor-simulation-status")).toHaveText("3 frequency points calculated", { timeout: 120_000 });
  await expect(page.locator("aside").getByText("Impedance", { exact: false }).first()).toBeVisible();
  await expect(page.locator("aside").getByText("SWR", { exact: false }).first()).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("unsupported NEC cards block editing and retain the original decoded source download", async ({ page }) => {
  await page.goto("/editor");
  await dismissChangelog(page);
  await openImport(page);
  const input = page.locator('input[type="file"][accept*=".nec"]');
  await input.setInputFiles({ name: "unsupported-arc.nec", mimeType: "text/plain", buffer: Buffer.from(UNSUPPORTED_ARC) });

  const report = page.getByTestId("nec-import-report");
  await expect(report).toContainText("raw only");
  await expect(report).toContainText("blocking: 1");
  await expect(report).toContainText("previous editor model was left untouched");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Original NEC (source text)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("unsupported-arc.nec");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe(UNSUPPORTED_ARC);
});
