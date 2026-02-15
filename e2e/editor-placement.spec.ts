import { test, expect } from "@playwright/test";

test("editor upload + clamp + persistence", async ({ page }) => {
  await page.goto("/jobs/demo/editor");
  await page.setInputFiles('input[type="file"]', "./e2e/fixtures/sample.png");

  await page.getByLabel("Width (mm)").fill("90");
  await page.getByLabel("Height (mm)").fill("60");

  await page.mouse.move(800, 200);
  await page.mouse.down();
  await page.mouse.move(1200, 200);
  await page.mouse.up();

  await expect(page.getByText(/safe-zone boundary/i)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Width (mm)")).toHaveValue("90");
});
