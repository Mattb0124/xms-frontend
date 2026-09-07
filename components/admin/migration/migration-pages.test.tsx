import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminMigrationBatchPage from "@/app/(internal)/admin/migration/[id]/page";
import AdminMigrationNewPage from "@/app/(internal)/admin/migration/new/page";
import AdminMigrationPage from "@/app/(internal)/admin/migration/page";
import { ACCOUNT_ID, BATCH_ID, INSTANCE_ID, aBatch, aBatchDetail, aReport } from "@/redux/migrationApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const navigation = vi.hoisted(() => ({
  search: "",
  pathname: "/admin/migration",
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.search),
  useParams: () => ({ id: BATCH_ID }),
}));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

const granted = () => json([{ id: ACCOUNT_ID, key: "BRK", name: "Brookfield", status: "active" }]);

describe("AdminMigrationPage", () => {
  beforeEach(() => {
    navigation.search = "";
    navigation.pathname = "/admin/migration";
    navigation.replace.mockReset();
    navigation.push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without admin:migration and never asks for batches", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["admin:accounts", "admin:config"]) });
    renderDesk(<AdminMigrationPage />);
    await screen.findByText("Not permitted");
    expect(screen.getByText(/needs the admin:migration permission/)).toBeInTheDocument();
    expect(calls.some((call) => call.key === "GET /v1/migration/batches")).toBe(false);
  });

  it("reads the filters from the URL, sends them to the API and shows the account name on the chip", async () => {
    navigation.search = `account_id=${ACCOUNT_ID}&object_kind=case&status=failed`;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:migration"]),
      "GET /v1/accounts": granted,
      "GET /v1/migration/batches": () => json([aBatch({ status: "failed", error: "instance unreachable" })]),
    });
    renderDesk(<AdminMigrationPage />);
    await screen.findByRole("link", { name: BATCH_ID.slice(0, 8) });
    expect(calls.find((call) => call.key === "GET /v1/migration/batches")?.search).toBe(
      `?account_id=${ACCOUNT_ID}&object_kind=case&status=failed`,
    );
    expect(screen.getByText("Brookfield")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Reconciliation" }));
    await waitFor(() =>
      expect(calls.find((call) => call.key === "GET /v1/migration/reconciliation")?.search).toBe(
        `?account_id=${ACCOUNT_ID}`,
      ),
    );
  });

  it("asks for an account before showing reconciliation when none is filtered", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:migration"]),
      "GET /v1/accounts": granted,
      "GET /v1/migration/batches": () => json([]),
    });
    renderDesk(<AdminMigrationPage />);
    await screen.findByText(/Create the first batch for an account/);
    fireEvent.click(screen.getByRole("tab", { name: "Reconciliation" }));
    expect(screen.getByText(/Add an account filter to see its reconciliation reports/)).toBeInTheDocument();
    expect(calls.some((call) => call.key === "GET /v1/migration/reconciliation")).toBe(false);
  });
});

describe("AdminMigrationNewPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("prefills the form from the URL and moves to the new record", async () => {
    navigation.search = `account_id=${ACCOUNT_ID}&instance_id=${INSTANCE_ID}&opened_from=2025-01-01&opened_to=2025-12-31&supersedes=${BATCH_ID}`;
    const created = aBatch({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" });
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:migration"]),
      "GET /v1/accounts": granted,
      "POST /v1/migration/batches": () => json(created, 201),
    });
    renderDesk(<AdminMigrationNewPage />);
    await screen.findByRole("form", { name: "New batch" });
    expect(screen.getByLabelText("Account")).toHaveValue(ACCOUNT_ID);
    expect(screen.getByLabelText("Opened from")).toHaveValue("2025-01-01");
    fireEvent.click(screen.getByRole("button", { name: "Create batch" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/admin/migration/${created.id}`));
    expect(calls.find((call) => call.key === "POST /v1/migration/batches")?.body).toMatchObject({
      account_id: ACCOUNT_ID,
      instance_id: INSTANCE_ID,
      supersedes_batch_id: BATCH_ID,
    });
  });
});

describe("AdminMigrationBatchPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("runs a draft with a confirm and shows the finished counts", async () => {
    let ran = false;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:migration"]),
      "GET /v1/accounts": granted,
      [`GET /v1/migration/batches/${BATCH_ID}`]: () =>
        json(
          ran
            ? aBatchDetail({
                status: "reconciled",
                counts: { extracted: 3, loaded: 0, updated: 0, skipped: 0, unmatched: 1, errors: 0 },
                report: aReport(),
              })
            : aBatchDetail(),
        ),
      [`GET /v1/migration/batches/${BATCH_ID}/records`]: () => json([]),
      [`POST /v1/migration/batches/${BATCH_ID}/run`]: () => {
        ran = true;
        return json(
          aBatchDetail({
            status: "reconciled",
            counts: { extracted: 3, loaded: 0, updated: 0, skipped: 0, unmatched: 1, errors: 0 },
            report: aReport(),
          }),
          201,
        );
      },
    });
    renderDesk(<AdminMigrationBatchPage />);
    const run = await screen.findByRole("button", { name: "Run dry run" });
    expect(run).toBeEnabled();
    fireEvent.click(run);
    fireEvent.click(screen.getByRole("button", { name: "Confirm dry run" }));
    await screen.findByText("3 extracted, 0 loaded, 0 updated, 1 unmatched, 0 errors.");
    expect(calls.some((call) => call.key === `POST /v1/migration/batches/${BATCH_ID}/run`)).toBe(true);
    await screen.findByText("Reconciled", { selector: "[data-state]" });
    expect(screen.getByRole("button", { name: "Run dry run" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Run again as a new batch" })).toHaveAttribute(
      "href",
      `/admin/migration/new?account_id=${ACCOUNT_ID}&instance_id=${INSTANCE_ID}&opened_from=2025-01-01&opened_to=2025-12-31&supersedes=${BATCH_ID}`,
    );
  });

  it("disables Run while the batch runs and when it is superseded, with the reason", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["admin:migration"]),
      "GET /v1/accounts": granted,
      [`GET /v1/migration/batches/${BATCH_ID}`]: () => json(aBatchDetail({ status: "loading", dry_run: false })),
      [`GET /v1/migration/batches/${BATCH_ID}/records`]: () => json([]),
    });
    const { unmount } = renderDesk(<AdminMigrationBatchPage />);
    expect(await screen.findByRole("button", { name: "Run" })).toBeDisabled();
    expect(screen.getByText("This batch is running.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByRole("link", { name: "Run again as a new batch" })).not.toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();

    stubFetch({
      "GET /v1/admin/me": me(["admin:migration"]),
      "GET /v1/accounts": granted,
      [`GET /v1/migration/batches/${BATCH_ID}`]: () => json(aBatchDetail({ status: "superseded" })),
      [`GET /v1/migration/batches/${BATCH_ID}/records`]: () => json([]),
    });
    renderDesk(<AdminMigrationBatchPage />);
    expect(await screen.findByRole("button", { name: "Run dry run" })).toBeDisabled();
    expect(screen.getByText(/superseded this one/)).toBeInTheDocument();
  });

  it("shows the server's refusal when the run is rejected", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["admin:migration"]),
      "GET /v1/accounts": granted,
      [`GET /v1/migration/batches/${BATCH_ID}`]: () => json(aBatchDetail({ status: "failed" })),
      [`GET /v1/migration/batches/${BATCH_ID}/records`]: () => json([]),
      [`POST /v1/migration/batches/${BATCH_ID}/run`]: () =>
        json({ code: "batch_not_runnable", status: "signed_off" }, 409),
    });
    renderDesk(<AdminMigrationBatchPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Run dry run" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm dry run" }));
    await screen.findByText("This batch is signed off and cannot be run again.");
  });
});
