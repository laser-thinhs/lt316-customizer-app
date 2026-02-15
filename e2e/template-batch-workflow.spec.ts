import { test, expect } from "@playwright/test";

test("template and batch operator workflow pages render", async ({ page }) => {
  await page.goto("/templates");
  await expect(page.getByText("Templates")).toBeVisible();

  await page.goto("/templates/demo-template");
  await expect(page.getByText(/Template Detail/i)).toBeVisible();

  await page.goto("/batch/new");
  await expect(page.getByText("New Batch Run")).toBeVisible();

  await page.goto("/batch/demo-batch");
  await expect(page.getByText(/Batch Run demo-batch/i)).toBeVisible();
});
