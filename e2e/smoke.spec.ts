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

  /**
   * Security review finding 25. The policy is an XSS control only while
   * every script the framework emits carries the request's nonce and none of
   * them leans on `'unsafe-inline'`; a page that quietly loses one shows up
   * here as a refusal in the console.
   */
  test("every script carries the request nonce and nothing is blocked", async ({ page }) => {
    const blocked: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy|Refused to (execute|load)/i.test(message.text())) blocked.push(message.text());
    });
    const response = await page.goto("/");
    const csp = response?.headers()["content-security-policy"] ?? "";
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce, "the response policy carries a nonce").toBeTruthy();
    expect(csp).toContain("'strict-dynamic'");
    expect(csp.split(";").find((part) => part.trim().startsWith("script-src"))).not.toContain("'unsafe-inline'");

    // Browsers blank the nonce *attribute* once the document is parsed and
    // keep the value on the IDL property alone, so that a CSS attribute
    // selector cannot exfiltrate it. Reading `.nonce` is the only way to see
    // what the script actually carries.
    const scripts = await page.locator("script").evaluateAll((nodes) =>
      nodes.map((node) => ({
        nonce: (node as HTMLScriptElement).nonce,
        src: node.getAttribute("src") ?? "inline",
      })),
    );
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.filter((script) => !script.nonce).map((script) => script.src)).toEqual([]);
    expect(blocked).toEqual([]);
  });
});
