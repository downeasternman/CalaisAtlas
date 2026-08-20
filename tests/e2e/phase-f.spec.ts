import { test, expect } from "@playwright/test";

test.describe("Phase F — per-acre cohort choropleth", () => {
  test("valuation legend, cohort toggle, and exempt swatch are visible", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Assessed value / acre" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Cohort visibility" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Both", pressed: true })).toBeVisible();
    await expect(page.getByText("Fully tax-exempt")).toBeVisible();
    await expect(page.getByText("Homestead exemption")).toBeVisible();
    await expect(page.getByText("$25k / $31k exemption in commitment book")).toBeVisible();
    await expect(page.getByText("Lowest $/ac").first()).toBeVisible();
    await expect(page.getByLabel("Town")).toHaveCount(0);
  });

  test("cohort toggle switches pressed state", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Improved" })).toBeVisible();
    await page.getByRole("button", { name: "Improved" }).click();
    await expect(page.getByRole("button", { name: "Improved", pressed: true })).toBeVisible();
    await page.getByRole("button", { name: "Unimproved" }).click();
    await expect(
      page.getByRole("button", { name: "Unimproved", pressed: true }),
    ).toBeVisible();
  });

  test("parcel detail panel is hidden until a parcel is selected", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Parcel details")).toHaveCount(0);
  });

  test("parcel API returns 404 for unknown id", async ({ request }) => {
    const res = await request.get("/api/parcels/org-calais-does-not-exist");
    expect(res.status()).toBe(404);
  });

  test("joined Calais parcel returns per-acre valuation fields", async ({ request }) => {
    const res = await request.get("/api/parcels/org-calais-29070-037-256");
    expect(res.status()).toBe(200);
    const parcel = await res.json();
    expect(parcel.ownerName?.toUpperCase()).toContain("UNITED STATES");
    expect(parcel.assessedTotalValue).toBeTruthy();
    expect(parcel.taxSource?.name).toMatch(/Calais/i);
    expect(parcel).toHaveProperty("valuePerAcre");
    expect(parcel).toHaveProperty("cohort");
    expect(parcel).toHaveProperty("fullyExempt");
    expect(parcel).toHaveProperty("homestead");
    expect(parcel.gisAcreage).toBeTruthy();
  });
});
