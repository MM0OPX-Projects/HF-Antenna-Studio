import { expect, test } from "@playwright/test";

const cases = [
  ["horizontal", "0"], ["sloper", "1"], ["inverted-V", "2"], ["vertical", "3"],
] as const;

for (const [name, orientation] of cases) {
  for (const [feedName, feedEnd] of [["End A", "0"], ["End B", "1"]] as const) {
    test(`EFHW ${name} ${feedName} completes a real local NEC solve`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto("/");
      const changelog = page.getByRole("button", { name: "Got it" });
      if (await changelog.isVisible().catch(() => false)) await changelog.click();
      await page.getByRole("button", { name: /Dipole.*Change/i }).click();
      await page.getByRole("button", { name: /EFHW/i }).click();
      await page.getByLabel("Orientation").selectOption(orientation);
      await page.getByLabel("Feed End").selectOption(feedEnd);
      await page.getByLabel("Radiation pattern angular resolution").selectOption("10");
      await expect(page.getByRole("button", { name: /Run Simulation/i })).toBeEnabled();
      await page.getByRole("button", { name: /Run Simulation/i }).click();
      await expect(page.getByText(/freq pts/i)).toBeVisible({ timeout: 150_000 });
      await expect(page.locator('p[role="alert"]')).toHaveCount(0);
    });
  }
}

test("EFHW inverted-V End B transfers to Wire Editor and solves", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/editor");
  const changelog = page.getByRole("button", { name: "Got it" });
  if (await changelog.isVisible().catch(() => false)) await changelog.click();
  await page.getByLabel("Wire editor section").selectOption("templates");
  await page.getByRole("button", { name: /Dipole.*Change/i }).click();
  await page.getByRole("button", { name: /EFHW/i }).click();
  await page.getByLabel("Orientation").selectOption("2");
  await page.getByLabel("Feed End").selectOption("1");
  await page.getByRole("button", { name: "Load into Editor" }).click();
  await expect(page.getByRole("button", { name: /Source 1.*wire 2/i }).first()).toBeVisible();
  await page.getByLabel("Wire editor section").selectOption("settings");
  await page.getByText("Pattern Resolution").locator("..").getByRole("combobox").selectOption("10");
  await page.getByRole("button", { name: "Run Simulation" }).click();
  await expect(page.getByText(/solved points/i)).toBeVisible({ timeout: 150_000 });
});
