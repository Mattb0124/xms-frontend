import { expect, test } from "@playwright/test";

/**
 * The ticket golden path against a running backend (Implementation Plan
 * P1.5.5 done-when): create a ticket, reply publicly, add a work note, move
 * to In progress. Skipped unless E2E_API_TOKEN is set.
 *
 * To run locally:
 *   backend:  pnpm db:up && pnpm db:migrate && pnpm seed:dev && pnpm start:dev
 *             pnpm dev:token --email admin@example.test   (copy the token)
 *   frontend: E2E_API_TOKEN=<token> pnpm test:e2e e2e/tickets.spec.ts
 * The frontend must run in dev mode (NEXT_PUBLIC_AUTH_DEV_MODE=true) so the
 * token can be placed in localStorage under `xms.devToken`.
 */
const token = process.env.E2E_API_TOKEN;

test.describe("tickets golden path", () => {
  test.skip(!token, "E2E_API_TOKEN is not set; see the header of this file");

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((value) => window.localStorage.setItem("xms.devToken", value), token!);
  });

  test("create a ticket, reply, add a work note, move to In progress", async ({ page }) => {
    await page.goto("/cases/new");
    await page.getByLabel("Account *").selectOption({ index: 1 });
    await page.getByLabel("Impact").selectOption("high");
    await page.getByLabel("Urgency").selectOption("high");
    await expect(page.getByTestId("priority-preview")).toContainText("P1");
    await page.getByLabel("Short description").fill("E2E: cube refresh fails");
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page).toHaveURL(/\/tickets\/CS\d{7}$/);
    await expect(page.getByRole("form", { name: "Composer" })).toBeVisible();

    await page.getByLabel("Public reply").fill("We are looking at it now");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("First response")).toBeVisible();

    await page.getByRole("tab", { name: "Work note" }).click();
    await page.getByRole("textbox", { name: "Work note" }).fill("Internal: waiting on the log export");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Internal", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: /State New, change/ }).click();
    await page.getByRole("menuitem", { name: /In progress/ }).click();
    await expect(page.getByRole("button", { name: /State In progress, change/ })).toBeVisible();

    await page.goto("/cases?view=mine");
    await expect(page.getByRole("region", { name: "Count" }).or(page.getByLabel("Count"))).toBeVisible();
  });
});
