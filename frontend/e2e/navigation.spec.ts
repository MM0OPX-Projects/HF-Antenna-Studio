import { expect, test, type Page } from "@playwright/test";
import { APP_NAV_LINKS } from "../src/navigation";

const FEATURE_ROUTES = APP_NAV_LINKS.filter(({ to }) => to !== "/");
const ROUTE_SHELL_PAGES = [
  "/frequency-analyser",
  "/model-comparison",
  "/parameter-sweeps",
  "/antenna-optimiser",
  "/measurement-comparison",
] as const;

async function dismissChangelog(page: Page): Promise<void> {
  for (const name of [/Close changelog/i, /Got it/i]) {
    const button = page.getByRole("button", { name });
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }
  }
}

async function navigateFromStart(page: Page, path: string, compact: boolean): Promise<void> {
  await page.goto("/");
  await dismissChangelog(page);

  let destination = page.locator(`nav a[href="${path}"]:visible`);
  if (!(await destination.count())) {
    await page
      .getByRole("button", { name: compact ? "Toggle navigation menu" : "Modules" })
      .click();
    destination = page.locator(`nav a[href="${path}"]:visible`);
  }

  await expect(destination, `start navigation should expose ${path}`).toHaveCount(1);
  await destination.click();
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
  await expect(page.locator("main").first()).toBeVisible();
}

async function expectApplicationReturn(page: Page): Promise<void> {
  const banner = page.getByRole("banner");
  await expect(banner).toBeVisible();
  const home = banner.getByRole("link", { name: /^HF Antenna Studio/ });
  await expect(home).toBeVisible();
  await home.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /Run( Simulation)?/ }).first()).toBeVisible();
}

test.describe("application navigation regression", () => {
  test("opens every feature and returns to the start in the desktop layout", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    let activeRoute = "/";
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(`${activeRoute}: ${error.stack ?? error.message}`));

    for (const { to, label } of FEATURE_ROUTES) {
      await test.step(`${label}: start → feature → start`, async () => {
        activeRoute = to;
        await navigateFromStart(page, to, false);
        await expectApplicationReturn(page);
      });
    }

    expect(consoleErrors, "browser console errors").toEqual([]);
    expect(pageErrors, "uncaught page errors").toEqual([]);
  });

  test("keeps every repaired route escapable in the compact layout", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });

    for (const path of ROUTE_SHELL_PAGES) {
      await test.step(`${path}: compact start → feature → start`, async () => {
        await navigateFromStart(page, path, true);
        await expectApplicationReturn(page);
      });
    }
  });

  test("retains an explicit recovery path for an unknown route", async ({ page }) => {
    await page.goto("/not-a-real-feature");
    await dismissChangelog(page);
    const recovery = page.getByRole("link", { name: /Back to Simulator/i });
    await expect(recovery).toBeVisible();
    await recovery.click();
    await expect(page).toHaveURL(/\/$/);
  });
});
