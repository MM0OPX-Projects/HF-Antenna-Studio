import { expect, test } from "@playwright/test";

async function dismissChangelog(page: import("@playwright/test").Page): Promise<void> {
  const button = page.getByRole("button", { name: "Got it" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

test("browser fallback exposes the release identity without requiring native commands", async ({ page }) => {
  await page.goto("/about");
  await dismissChangelog(page);

  await expect(page.getByRole("heading", { name: "About HF Antenna Studio" })).toBeVisible();
  await expect(page.getByTestId("about-version")).toHaveText("1.0.0");
  await expect(page.getByRole("link", { name: "Licences and notices" })).toHaveAttribute("href", "/licenses.html");
  await expect(page.getByTestId("about-runtime-mode")).toHaveText("Browser development application");
  await expect(page.getByTestId("about-log-directory")).toHaveText("Browser developer console");
  await expect(page.getByRole("button", { name: "Open log folder" })).toHaveCount(0);
});

test("normal verified calculation does not require an external network", async ({ context, page }) => {
  const externalRequests: string[] = [];
  await context.route(/^https?:\/\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      await route.continue();
    } else {
      externalRequests.push(route.request().url());
      await route.abort("internetdisconnected");
    }
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") externalRequests.push(request.url());
  });

  await page.goto("/verified-dipole");
  await dismissChangelog(page);
  await page.getByTestId("run-dipole").click();
  await expect(page.getByTestId("dipole-results")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("wasm-nec2c", { exact: false })).toBeVisible();
  expect(externalRequests).toEqual([]);
});
