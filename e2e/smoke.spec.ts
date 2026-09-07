import { expect, test } from "@playwright/test";

/**
 * Smoke over both hosts. The shell and the security headers need no
 * identity; the signed-in assertions run when the tokens are provided
 * (E2E_API_TOKEN for the desk, E2E_PORTAL_TOKEN for the portal, both from
 * `pnpm dev:token` in the backend) and fall back to the sign-in prompts.
 */
const deskToken = process.env.E2E_API_TOKEN;
const portalToken = process.env.E2E_PORTAL_TOKEN;

test.describe("smoke", () => {
  test("internal root renders the shell inside the xms scope", async ({ page }) => {
    if (deskToken) {
      await page.addInitScript((value) => window.localStorage.setItem("xms.devToken", value), deskToken);
    }
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/xms-scope/);
    await expect(page.getByTestId("finder-bar")).toBeVisible();
    await expect(page.getByTestId("pinned-sidebar")).toBeVisible();
    if (deskToken) {
      await expect(page.getByRole("heading", { name: "My work" })).toBeVisible();
    }
  });

  test("token check page renders the state ramp", async ({ page }) => {
    await page.goto("/dev/tokens");
    await expect(page.locator(".xms-state[data-state='awaiting-client']")).toHaveText("Awaiting client");
  });

  test("portal root renders the search-first home for a signed-in client, the sign-in prompt otherwise", async ({
    page,
  }) => {
    if (portalToken) {
      await page.addInitScript((value) => window.localStorage.setItem("xms.devToken", value), portalToken);
    }
    await page.goto("/portal");
    if (portalToken) {
      await expect(page.getByRole("heading", { name: "What do you need help with?" })).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    }
  });

  test("security headers are present", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });
});
