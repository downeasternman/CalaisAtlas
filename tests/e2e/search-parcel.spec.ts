import { test, expect } from "@playwright/test";

test.describe("Property search", () => {
  test("finds a parcel and opens detail with URL param", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Search property")).toBeVisible();

    await page.getByLabel("Search property").fill("united states");
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10000 });
    await page.getByRole("option").first().click();

    await expect(page.getByLabel("Parcel details")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/parcel=org-calais-/);
  });
});
