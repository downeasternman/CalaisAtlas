import { test, expect } from "@playwright/test";

test.describe("Phase E — valuation choropleth", () => {
  test("valuation legend is visible and town filter is absent", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Assessed total" })).toBeVisible();
    await expect(page.getByText("Lowest assessed")).toBeVisible();
    await expect(page.getByText("No assessment")).toBeVisible();
    await expect(page.getByLabel("Town")).toHaveCount(0);
  });

  test("parcel detail panel is hidden until a parcel is selected", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Parcel details")).toHaveCount(0);
  });

  test("parcel API returns 404 for unknown id", async ({ request }) => {
    const res = await request.get("/api/parcels/org-calais-does-not-exist");
    expect(res.status()).toBe(404);
  });

  test("joined Calais parcel returns assessed total and percentile", async ({
    request,
  }) => {
    const res = await request.get("/api/parcels/org-calais-29070-037-256");
    expect(res.status()).toBe(200);
    const parcel = await res.json();
    expect(parcel.ownerName?.toUpperCase()).toContain("UNITED STATES");
    expect(parcel.assessedTotalValue).toBeTruthy();
    expect(parcel.valuePct).toBe(100);
    expect(parcel.taxSource?.name).toMatch(/Calais/i);
  });
});
