import { test, expect } from "@playwright/test";

test.describe("Phase C place search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 15000 });
  });

  test("place search is visible and town filter is absent", async ({ page }) => {
    await expect(page.getByLabel("Search places")).toBeVisible();
    await expect(page.getByLabel("Town")).toHaveCount(0);
  });

  test("place search returns results for Calais", async ({ page }) => {
    const search = page.getByLabel("Search places");
    await search.fill("Calais");
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("option", { name: /Calais/i })).toBeVisible();
  });
});
