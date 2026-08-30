import { expect, test } from "@playwright/test";

async function dismissFirstRunNotice(page: import("@playwright/test").Page) {
  const close = page.getByRole("button", { name: "Close changelog" });
  if (await close.isVisible()) await close.click();
}

test.describe("professional application workbench", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("keeps inputs, geometry, calculated values, and analysis distinct", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto("/");
    await dismissFirstRunNotice(page);

    await expect(page.getByTestId("professional-workbench")).toBeVisible();
    await expect(page.getByTestId("workbench-inputs")).toBeVisible();
    await expect(page.getByTestId("geometry-viewport")).toBeVisible();
    await expect(page.getByTestId("workbench-summary")).toBeVisible();
    await expect(page.getByTestId("workbench-analysis")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.getByText("Not calculated", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Input conditions", { exact: true })).toBeVisible();
    await expect(page.getByText("Selected-frequency result", { exact: true })).toBeVisible();

    const inputDivider = page.getByRole("separator", { name: "Resize antenna inputs" });
    const initialSize = await inputDivider.getAttribute("aria-valuenow");
    const dividerBox = await inputDivider.boundingBox();
    expect(dividerBox).not.toBeNull();
    await page.mouse.move(dividerBox!.x + dividerBox!.width / 2, dividerBox!.y + 50);
    await page.mouse.down();
    await page.mouse.move(dividerBox!.x + 32, dividerBox!.y + 50);
    await page.mouse.up();
    expect(Number(await inputDivider.getAttribute("aria-valuenow"))).toBeGreaterThan(Number(initialSize));
    const draggedSize = await inputDivider.getAttribute("aria-valuenow");
    await inputDivider.focus();
    await page.keyboard.press("ArrowRight");
    expect(Number(await inputDivider.getAttribute("aria-valuenow"))).toBeGreaterThan(Number(draggedSize));

    await page.keyboard.press("Control+Shift+R");
    await expect(page.getByTestId("workbench-summary")).toHaveCount(0);
    await page.keyboard.press("Control+Shift+R");
    await expect(page.getByTestId("workbench-summary")).toBeVisible();

    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Keyboard Shortcuts" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Keyboard Shortcuts" })).toHaveCount(0);

    await page.getByRole("button", { name: "Run Simulation" }).click();
    await expect(page.getByText("Results current", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("results-radiation-cuts-azimuth")).toBeVisible();
    await expect(page.getByTestId("results-radiation-cuts-elevation")).toBeVisible();
    await expect(page.getByTestId("results-radiation-cuts-azimuth").getByTestId("azimuth-polar-plot"))
      .toHaveAttribute("viewBox", "0 0 460 390");
    const groundedElevationPath = await page.getByTestId("results-radiation-cuts-elevation")
      .locator('[data-testid^="polar-series-elevation-"]')
      .first()
      .getAttribute("d");
    expect(groundedElevationPath).toMatch(/^M 230\.00 205\.00/);
    expect(groundedElevationPath).toMatch(/230\.00 205\.00$/);
    await expect(page.getByText("Resistance R", { exact: true })).toBeVisible();
    await expect(page.getByText("Reactance X", { exact: true })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("supports theme control without making colour the only status signal", async ({ page }) => {
    await page.goto("/");
    await dismissFirstRunNotice(page);
    const themeButton = page.getByRole("button", { name: /Switch to (light|dark) theme/ });
    const before = await page.locator("html").getAttribute("class");
    await themeButton.click();
    await expect.poll(() => page.locator("html").getAttribute("class")).not.toBe(before);
    await expect(page.getByTestId("calculation-status").first()).toContainText("Not calculated");
  });
});

test.describe("responsive workspace", () => {
  test("uses the compact three-pane layout at tablet landscape size", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/");
    await dismissFirstRunNotice(page);
    await expect(page.getByTestId("professional-workbench")).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Run Simulation" })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Workspace panel" })).toHaveCount(0);
  });

  test("keeps essential controls reachable on a narrow tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/");
    await dismissFirstRunNotice(page);
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.getByRole("tablist", { name: "Workspace panel" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
    await page.getByRole("tab", { name: "Antenna" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Results" })).toHaveAttribute("aria-selected", "true");
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(horizontalOverflow).toBe(false);
  });
});
