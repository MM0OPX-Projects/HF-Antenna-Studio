import { expect, test, type Locator, type Page } from "@playwright/test";

const isWindowsCi = process.platform === "win32" && Boolean(process.env.CI);
const currentTestTimeoutMs = isWindowsCi ? 720_000 : 120_000;
const currentPanelTimeoutMs = isWindowsCi ? 600_000 : 60_000;

async function dismissChangelog(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Got it" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function inspectFirstSegment(panel: Locator): Promise<void> {
  await expect(panel).toBeVisible({ timeout: currentPanelTimeoutMs });
  await expect(panel).toHaveAttribute("data-current-source", "nec-solver");
  expect(Number(await panel.getAttribute("data-current-count"))).toBeGreaterThan(0);
  await panel.getByTestId("current-mode-phase").click();
  await expect(panel.getByTestId("current-mode-phase")).toHaveAttribute("aria-pressed", "true");
  await panel.getByTestId("current-mode-combined").click();
  await expect(panel.getByTestId("current-mode-combined")).toHaveAttribute("aria-pressed", "true");
  await panel.getByTestId("current-animation").check();
  await expect(panel.getByTestId("current-legend")).toContainText("instantaneous current");
  await panel.getByTestId("current-segment-select").selectOption({ index: 1 });
  await expect(panel.getByTestId("current-inspector")).toContainText("NEC segment");
  await expect(panel.getByTestId("current-inspector")).toContainText("phase");
  await expect(panel.getByTestId("current-inspector")).toContainText("Position (");
  await expect(panel.getByTestId("current-inspector")).toContainText("m");
  await expect(panel.getByTestId(`${await panel.getAttribute("data-testid")}-3d`).locator("canvas")).toBeVisible();
}

const currentModels = [
  { name: "dipole", path: "/verified-dipole", panel: "dipole-current-visualisation", run: "run-dipole" },
  { name: "vertical", path: "/vertical-antennas", panel: "vertical-current-visualisation", run: "run-vertical-nec" },
  { name: "loop", path: "/loop-and-hexbeam-models", panel: "loop-current-visualisation" },
  { name: "Yagi", path: "/yagi-beams", panel: "yagi-current-visualisation" },
  { name: "phased array", path: "/phased-arrays", panel: "phased-current-visualisation" },
] as const;

for (const model of currentModels) {
  test(`actual NEC segment current controls work for the ${model.name} model`, async ({ page }) => {
    test.setTimeout(currentTestTimeoutMs);
    const consoleProblems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleProblems.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

    await page.goto(model.path);
    await dismissChangelog(page);
    if ("run" in model) await page.getByTestId(model.run).click();
    await inspectFirstSegment(page.getByTestId(model.panel));

    expect(consoleProblems).toEqual([]);
  });
}
