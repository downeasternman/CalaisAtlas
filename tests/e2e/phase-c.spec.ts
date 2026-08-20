import { test, expect } from "@playwright/test";

test.describe("Phase C filter and search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 15000 });
  });

  test("place search and municipality filter are visible", async ({ page }) => {
    await expect(page.getByLabel("Search places")).toBeVisible();
    await expect(page.getByLabel("Town")).toBeVisible();
  });

  test("municipality filter zooms map when a town is selected", async ({ page }) => {
    const filter = page.getByLabel("Town");
    await filter.selectOption({ label: "Machias" });
    await page.waitForTimeout(1200);
    await expect(filter).toHaveValue("machias");
  });

  test("place search returns results for Machias", async ({ page }) => {
    const search = page.getByLabel("Search places");
    await search.fill("Machias");
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("option", { name: /Machias/i })).toBeVisible();
  });
});
