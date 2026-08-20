import { chromium } from "@playwright/test";
import { mkdir } from "fs/promises";
import path from "path";

const OUT_DIR = path.join(process.cwd(), "docs", "screenshots");
const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";

async function waitForMap(page: import("@playwright/test").Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.locator(".maplibregl-canvas").waitFor({ timeout: 30000 });
  await page.waitForTimeout(3500);
}

async function clickParcelOnCanvas(page: import("@playwright/test").Page): Promise<boolean> {
  const canvas = page.locator(".maplibregl-canvas");
  const box = await canvas.boundingBox();
  if (!box) return false;

  for (let y = 0.25; y <= 0.75; y += 0.08) {
    for (let x = 0.25; x <= 0.75; x += 0.08) {
      await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
      await page.waitForTimeout(600);
      const panel = page.getByRole("complementary", { name: "Parcel details" });
      if (await panel.isVisible()) {
        const loading = await page.getByText("Loading parcel…").count();
        if (loading === 0) return true;
        await page.waitForTimeout(1200);
        return true;
      }
    }
  }
  return false;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await waitForMap(page);
  await page.screenshot({ path: path.join(OUT_DIR, "map-overview.png") });

  const search = page.getByLabel("Search places");
  await search.fill("Machias");
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT_DIR, "place-search.png") });

  await search.fill("");
  await page.keyboard.press("Escape");
  const filter = page.getByLabel("Town");
  await filter.selectOption({ label: "Lubec" });
  await page.waitForTimeout(3000);

  const clicked = await clickParcelOnCanvas(page);
  if (!clicked) {
    console.warn("Could not open parcel detail panel via map click; capturing Lubec view anyway.");
  } else {
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "parcel-detail.png") });

  await browser.close();
  console.log(`Screenshots saved to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
