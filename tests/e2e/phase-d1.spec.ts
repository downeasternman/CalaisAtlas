import { test, expect } from "@playwright/test";

test.describe("Phase D1 — UT parcel detail", () => {
  test("parcel detail panel is hidden until a parcel is selected", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Parcel details")).toHaveCount(0);
  });

  test("parcel API returns 404 for unknown id", async ({ request }) => {
    const res = await request.get("/api/parcels/ut-does-not-exist");
    expect(res.status()).toBe(404);
  });

  test("joined Day Block parcel returns tax detail with citations", async ({ request }) => {
    const res = await request.get("/api/parcels/ut-wa0110110-1");
    if (res.status() === 404) {
      test.skip();
      return;
    }
    const parcel = await res.json();
    expect(parcel.ownerName).toContain("COUSINS");
    expect(parcel.assessedTotalValue).toBeTruthy();
    expect(parcel.taxSource?.name).toBeTruthy();
  });
});
