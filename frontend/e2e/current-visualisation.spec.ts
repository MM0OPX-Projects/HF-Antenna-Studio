import { expect, test, type Locator, type Page } from "@playwright/test";

async function dismissChangelog(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Got it" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function inspectFirstSegment(panel: Locator): Promise<void> {
  await expect(panel).toBeVisible({ timeout: 60_000 });
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

test("actual NEC segment current controls work for dipole, vertical, loop, Yagi and phased-array models", async ({ page }) => {
  const consoleProblems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.goto("/verified-dipole");
  await dismissChangelog(page);
  await page.getByTestId("run-dipole").click();
  await inspectFirstSegment(page.getByTestId("dipole-current-visualisation"));

  await page.goto("/vertical-antennas");
  await page.getByTestId("run-vertical-nec").click();
  await inspectFirstSegment(page.getByTestId("vertical-current-visualisation"));

  await page.goto("/loop-and-hexbeam-models");
  await inspectFirstSegment(page.getByTestId("loop-current-visualisation"));

  await page.goto("/yagi-beams");
  await inspectFirstSegment(page.getByTestId("yagi-current-visualisation"));

  await page.goto("/phased-arrays");
  await inspectFirstSegment(page.getByTestId("phased-current-visualisation"));

  expect(consoleProblems).toEqual([]);
});
