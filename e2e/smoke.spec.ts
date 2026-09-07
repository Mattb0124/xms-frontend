import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("internal root renders inside the xms scope with the token check", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/xms-scope/);
    await expect(page.getByRole("heading", { name: "My work" })).toBeVisible();
    await expect(page.locator(".xms-state[data-state='awaiting-client']")).toHaveText("Awaiting client");
  });

  test("portal root renders the search-first heading", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.getByRole("heading", { name: "What do you need help with?" })).toBeVisible();
  });

  test("security headers are present", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });
});
