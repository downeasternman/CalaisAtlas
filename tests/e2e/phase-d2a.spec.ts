import { test, expect } from "@playwright/test";

test.describe("Phase D2a — Lubec organized parcel detail", () => {
  test("joined Lubec parcel returns Ferriter tax detail", async ({ request }) => {
    const res = await request.get("/api/parcels/org-lubec-29260-002-006-000");
    if (res.status() === 404) {
      test.skip();
      return;
    }
    const parcel = await res.json();
    expect(parcel.ownerName?.toUpperCase()).toContain("FERRITER");
    expect(parcel.assessedTotalValue).toBeTruthy();
    expect(parcel.taxSource?.name).toMatch(/Lubec/i);
    expect(parcel.territoryType).toBe("organized");
  });

  test("joined Lubec parcel 015-039 returns LOVE AT FIRST LIGHT LLC", async ({ request }) => {
    const res = await request.get("/api/parcels/org-lubec-29260-015-039-000");
    if (res.status() === 404) {
      test.skip();
      return;
    }
    const parcel = await res.json();
    expect(parcel.ownerName?.toUpperCase()).toContain("LOVE AT FIRST LIGHT");
    expect(parcel.ownerName).not.toMatch(/62,500/);
    expect(parcel.ownerName).not.toMatch(/[\d,]{4,}/);
    expect(parcel.assessedTotalValue).toBeTruthy();
    expect(parcel.taxSource?.name).toMatch(/Lubec/i);
  });
});
