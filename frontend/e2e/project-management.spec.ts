import { expect, test, type Page } from "@playwright/test";

async function openProjects(page: Page): Promise<void> {
  await page.goto("/projects");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await expect(page.getByRole("heading", { name: "Project management" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

test("local projects support save, open, rename, duplicate, export, and confirmed delete", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await openProjects(page);

  await page.getByLabel("Project name").fill("20m field dipole");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Project saved locally.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "20m field dipole" })).toBeVisible();

  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Rename 20m field dipole").fill("Portable dipole");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("heading", { name: "Portable dipole" })).toBeVisible();
  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.getByRole("heading", { name: "Portable dipole copy" })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Portable dipole", exact: true }) }).getByRole("button", { name: "Export" }).click();
  expect((await download).suggestedFilename()).toBe("Portable-dipole.hfas");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Portable dipole copy", exact: true }) }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Portable dipole copy" })).toHaveCount(0);

  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Portable dipole", exact: true }) }).getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("HF Antenna Studio").first()).toBeVisible();
  await page.locator('button[title="Click to type a value"]').first().click();
  await page.locator('input[type="number"]').first().fill("14.2");
  await page.locator('input[type="number"]').first().press("Enter");
  await expect.poll(() => page.evaluate(() => {
    const library = JSON.parse(window.localStorage.getItem("hfas.project-library.v1") ?? "{}");
    return library.projects?.find((project: { name: string }) => project.name === "Portable dipole")?.revision ?? 0;
  })).toBeGreaterThanOrEqual(3);
  expect(browserErrors).toEqual([]);
});

test("recovery survives reload and legacy imports are reviewed before migration", async ({ page }) => {
  await openProjects(page);
  await page.getByRole("button", { name: "New template project" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Recovery copy available" })).toBeVisible();

  const legacy = {
    version: 1,
    app_version: "0.1.0",
    created_at: "2024-01-01T00:00:00.000Z",
    mode: "simulator",
    simulator: {
      templateId: "dipole",
      params: { frequency: 14.1, length: 10.1, height: 10, wireDiameter: 0.002 },
      ground: { type: "average" },
    },
    result: null,
  };
  await page.getByTestId("project-file-input").setInputFiles({
    name: "legacy-dipole.antennasim",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy, null, 2)),
  });
  await expect(page.getByText("Source schema 1; current schema 8.")).toBeVisible();
  await expect(page.getByText(/explicit sweep intent was unavailable/)).toBeVisible();
  await page.getByRole("button", { name: "Import and open" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "legacy-dipole" })).toBeVisible();
});

test("comparison projects reopen with exact real-ground radial identity", async ({ page }) => {
  await openProjects(page);
  await page.getByRole("button", { name: "New comparison" }).click();
  await expect(page).toHaveURL(/\/model-comparison$/);
  await page.getByTestId("comparison-preset-vertical").click();
  await page.getByTestId("comparison-ground").selectOption("sommerfeld-norton");
  await page.getByTestId("comparison-vertical-radial-mode").selectOption("near-surface");
  await page.getByTestId("comparison-radial-clearance").fill("15");
  await page.locator('button[title^="Save project"]').click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByLabel("Project name").fill("Ground radial comparison");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Ground radial comparison" }) }).getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/model-comparison$/);
  await expect(page.getByTestId("comparison-ground")).toHaveValue("sommerfeld-norton");
  await expect(page.getByTestId("comparison-vertical-radial-mode")).toHaveValue("near-surface");
  await expect(page.getByTestId("comparison-radial-clearance")).toHaveValue("15");
});
