import { test, expect } from "@playwright/test";

test.describe("Phase A scaffold", () => {
  test("homepage loads with brand title", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Washington County Atlas" })).toBeVisible();
  });

  test("map canvas is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 10000 });
  });
});
