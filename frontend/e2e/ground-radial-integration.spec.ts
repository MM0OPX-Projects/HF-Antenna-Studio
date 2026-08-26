import { expect, test, type Page } from "@playwright/test";

async function dismissChangelog(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Got it" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

test("the primary vertical template routes users to both explicit radial laboratories and back", async ({ page }) => {
  await page.goto("/");
  await dismissChangelog(page);

  await page.getByRole("button", { name: /Dipole.*Change/i }).click();
  await page.getByRole("button", { name: /Vertical Quarter-wave/i }).click();
  const scope = page.getByTestId("vertical-template-scope");
  await expect(scope).toContainText("elevated ground plane");

  await scope.getByRole("link", { name: "Vertical laboratory" }).click();
  await expect(page).toHaveURL(/\/vertical-antennas$/);
  await page.getByTestId("vertical-mode-ground-mounted-explicit-radials").click();
  await expect(page.getByTestId("vertical-surface-clearance")).toBeVisible();
  await expect(page.getByTestId("vertical-ground-explanation")).toContainText("radial wires and their currents are solved");

  await page.getByRole("link", { name: /^HF Antenna Studio/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("vertical-template-scope")).toBeVisible();
  await page.getByTestId("vertical-template-scope").getByRole("link", { name: "Phased Arrays laboratory" }).click();
  await expect(page).toHaveURL(/\/phased-arrays$/);
  await page.getByTestId("phased-radial-mode").selectOption("near-surface-explicit-wires");
  await expect(page.getByTestId("phased-radial-topology")).toHaveValue("shared-bonded-network");
  await expect(page.getByTestId("phased-ground")).toHaveValue("sommerfeld-norton");

  await page.getByRole("link", { name: /^HF Antenna Studio/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /Run Simulation/i })).toBeVisible();
});
