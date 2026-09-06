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

test("projects workspace returns to the active project and constrains the recent list", async ({ page }) => {
  await page.goto("/");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await page.locator('button[title^="Save project"]').first().click();
  await page.getByLabel("Project name").fill("Return navigation test");
  await page.getByRole("button", { name: "Save As", exact: true }).click();
  await expect(page.getByTestId("return-to-current-project")).toBeEnabled();
  await expect(page.getByTestId("recent-projects-list")).toHaveCSS("overflow-y", "auto");
  await page.getByTestId("return-to-current-project").click();
  await expect(page).toHaveURL(/\/$/);
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
  await expect(page.getByText("Source schema 1; current schema 10.")).toBeVisible();
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

test("specialist module Save As preserves phased feeds, correct routes, labels, and verified-dipole inputs", async ({ page }) => {
  await page.goto("/phased-arrays");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await page.getByTestId("phased-spacing-lambda").fill("0.1875");
  await page.getByTestId("phased-amplitude-2").fill("0.83");
  await page.getByTestId("phased-phase-2").fill("79");
  await page.locator('button[title^="Save project"]').click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByLabel("Project name").fill("Audited 40m phased array");
  await page.getByRole("button", { name: "Save As", exact: true }).click();
  const phasedCopy = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Audited 40m phased array" }) });
  await expect(phasedCopy.getByText(/Phased Arrays/)).toBeVisible();
  await phasedCopy.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/phased-arrays$/);
  await expect(page.getByTestId("phased-spacing-lambda")).toHaveValue("0.1875");
  await expect(page.getByTestId("phased-amplitude-2")).toHaveValue("0.83");
  await expect(page.getByTestId("phased-phase-2")).toHaveValue("79");

  await page.goto("/loop-and-hexbeam-models");
  await page.getByTestId("loop-frequency").fill("18.118");
  await page.locator('button[title^="Save project"]').click();
  await page.getByLabel("Project name").fill("Audited loop route");
  await page.getByRole("button", { name: "Save As", exact: true }).click();
  const loopCopy = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Audited loop route" }) });
  await expect(loopCopy.getByText(/Loops & Hexbeam/)).toBeVisible();
  await loopCopy.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/loop-and-hexbeam-models$/);
  await expect(page.getByTestId("loop-frequency")).toHaveValue("18.118");

  await page.goto("/verified-dipole");
  await page.getByTestId("frequency-mhz").fill("7.123");
  await page.getByTestId("ground-kind").selectOption("real");
  await page.getByTestId("ground-conductivity").fill("0.003");
  await page.locator('button[title^="Save project"]').click();
  await page.getByLabel("Project name").fill("Audited verified dipole");
  await page.getByRole("button", { name: "Save As", exact: true }).click();
  const dipoleCopy = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Audited verified dipole" }) });
  await expect(dipoleCopy.getByText(/Verified Dipole/)).toBeVisible();
  await dipoleCopy.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/verified-dipole$/);
  await expect(page.getByTestId("frequency-mhz")).toHaveValue("7.123");
  await expect(page.getByTestId("ground-kind")).toHaveValue("real");
  await expect(page.getByTestId("ground-conductivity")).toHaveValue("0.003");
});

test("all remaining specialist workspaces preserve their editable project inputs", async ({ page }) => {
  const saveAsAndOpen = async (name: string, expectedLabel: RegExp) => {
    await page.locator('button[title^="Save project"]').click();
    await expect(page).toHaveURL(/\/projects$/);
    await page.getByLabel("Project name").fill(name);
    await page.getByRole("button", { name: "Save As", exact: true }).click();
    const copy = page.getByRole("article").filter({ has: page.getByRole("heading", { name }) });
    await expect(copy.getByText(expectedLabel)).toBeVisible();
    await copy.getByRole("button", { name: "Open" }).click();
  };

  await page.goto("/dipole-height-lab");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await page.getByTestId("lab-frequency").fill("10.125");
  await page.getByTestId("height-slider").fill("0.73");
  await saveAsAndOpen("Audited height lab", /Dipole Height Lab/);
  await expect(page).toHaveURL(/\/dipole-height-lab$/);
  await expect(page.getByTestId("lab-frequency")).toHaveValue("10.125");
  await expect(page.getByTestId("height-slider")).toHaveValue("0.73");

  await page.goto("/antenna-templates");
  await page.getByTestId("template-inverted-v").click();
  await saveAsAndOpen("Audited antenna template", /Antenna Template Studio/);
  await expect(page).toHaveURL(/\/antenna-templates$/);
  await expect(page.getByTestId("template-inverted-v")).toHaveAttribute("aria-pressed", "true");

  await page.goto("/vertical-antennas");
  await page.getByTestId("vertical-frequency").fill("7.155");
  await page.getByTestId("vertical-radial-count").fill("96");
  await saveAsAndOpen("Audited vertical", /Vertical Antennas/);
  await expect(page).toHaveURL(/\/vertical-antennas$/);
  await expect(page.getByTestId("vertical-frequency")).toHaveValue("7.155");
  await expect(page.getByTestId("vertical-radial-count")).toHaveValue("96");

  await page.goto("/yagi-beams");
  await page.getByTestId("yagi-frequency").fill("28.4");
  await page.getByTestId("yagi-director-count").fill("4");
  await saveAsAndOpen("Audited Yagi", /Yagi Beams/);
  await expect(page).toHaveURL(/\/yagi-beams$/);
  await expect(page.getByTestId("yagi-frequency")).toHaveValue("28.4");
  await expect(page.getByTestId("yagi-director-count")).toHaveValue("4");

  await page.goto("/frequency-analyser");
  await page.getByTestId("sweep-start").fill("14.05");
  await page.getByTestId("reference-ohms").fill("75");
  await saveAsAndOpen("Audited analyser", /Frequency Analyser/);
  await expect(page).toHaveURL(/\/frequency-analyser$/);
  await expect(page.getByTestId("sweep-start")).toHaveValue("14.05");
  await expect(page.getByTestId("reference-ohms")).toHaveValue("75");

  await page.goto("/measurement-comparison");
  await page.getByTestId("comparison-start").fill("7.01");
  await page.getByTestId("comparison-reference").fill("75");
  await saveAsAndOpen("Audited measurement comparison", /Measurement Comparison/);
  await expect(page).toHaveURL(/\/measurement-comparison$/);
  await expect(page.getByTestId("comparison-start")).toHaveValue("7.01");
  await expect(page.getByTestId("comparison-reference")).toHaveValue("75");
});

test("Design, Wire Editor, sweeps, and optimiser Save As reopen in the correct mode", async ({ page }) => {
  await page.goto("/");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await page.getByRole("button", { name: /02 · Installation/ }).click();
  await page.getByLabel("Matching network preset").selectOption("9");
  await page.locator('button[title^="Save project"]').first().click();
  await page.getByLabel("Project name").fill("Audited design");
  await page.getByRole("button", { name: "Save As", exact: true }).click();
  const design = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Audited design" }) });
  await expect(design.getByText(/Template Simulator/)).toBeVisible();
  await design.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: /02 · Installation/ }).click();
  await expect(page.getByLabel("Matching network preset")).toHaveValue("9");

  await page.goto("/projects");
  await page.getByRole("button", { name: "New wire project" }).click();
  await page.locator('button[title^="Save project"]').first().click();
  await page.getByLabel("Project name").fill("Audited wire model");
  await page.getByRole("button", { name: "Save As", exact: true }).click();
  const editor = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Audited wire model" }) });
  await expect(editor.getByText(/Wire Editor/)).toBeVisible();
  await editor.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/editor$/);

  await page.goto("/projects");
  await page.getByRole("button", { name: "New parameter sweep" }).click();
  await page.locator('button[title^="Save project"]').click();
  await page.getByLabel("Project name").fill("Audited sweep");
  await page.getByRole("button", { name: "Save As", exact: true }).click();
  const sweep = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Audited sweep" }) });
  await expect(sweep.getByText(/Parameter Sweep/)).toBeVisible();
  await sweep.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/parameter-sweeps$/);

  await page.goto("/projects");
  await page.getByRole("button", { name: "New optimiser" }).click();
  await page.locator('button[title^="Save project"]').click();
  await page.getByLabel("Project name").fill("Audited optimiser");
  await page.getByRole("button", { name: "Save As", exact: true }).click();
  const optimiser = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Audited optimiser" }) });
  await expect(optimiser.getByText(/Antenna Optimiser/)).toBeVisible();
  await optimiser.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/antenna-optimiser$/);
});
