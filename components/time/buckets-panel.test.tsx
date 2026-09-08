import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BucketsPanel } from "@/components/time/buckets-panel";
import { aBucket, BUCKET_ID } from "@/redux/timeApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/accounts/acct-1" }));

const ACCOUNT_ID = "acct-1";
const BUCKETS = `GET /v1/accounts/${ACCOUNT_ID}/buckets`;
const PATCH = `PATCH /v1/accounts/${ACCOUNT_ID}/buckets/${BUCKET_ID}`;

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

const catalogs = () =>
  json({
    resolution_codes: [],
    activity_types: [],
    billable_classes: [
      { key: "billable", label: "Billable", consumes_contract: true },
      { key: "non_billable", label: "Non-billable", consumes_contract: false },
    ],
  });

function stub(permissions: string[], overrides: Record<string, () => Response> = {}) {
  return stubFetch({
    "GET /v1/admin/me": me(permissions),
    "GET /v1/catalogs": catalogs,
    [BUCKETS]: () => json([aBucket()]),
    [PATCH]: () => json(aBucket({ status: "retired", version: 2 })),
    ...overrides,
  });
}

/**
 * The account's non-ticket buckets (TB-12). The list is `time:log` and the
 * edit is `contracts:manage`; neither is the account record's own key, so
 * the panel asks for both itself.
 */
describe("BucketsPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks nothing without time:log and names the permission it needs", async () => {
    const calls = stub(["admin:accounts", "contracts:view", "contracts:manage"]);
    renderDesk(<BucketsPanel accountId={ACCOUNT_ID} />);
    await screen.findByText(/needs the time:log permission/);
    expect(calls.some((call) => call.key === BUCKETS)).toBe(false);
  });

  it("lists each bucket with its taxonomy and whether its class burns the contract, read only without the write key", async () => {
    stub(["admin:accounts", "time:log"]);
    const { container } = renderDesk(<BucketsPanel accountId={ACCOUNT_ID} />);
    const list = within(await screen.findByRole("list", { name: "Buckets" }));
    // The label and the taxonomy both read Governance on this bucket.
    expect(list.getAllByText("Governance")).toHaveLength(2);
    expect(list.getByText("governance")).toBeTruthy();
    expect(container.querySelector("[data-class]")?.textContent).toContain("does not consume the contract");
    expect(screen.queryByText("Edit")).toBeNull();
  });

  it("retires a bucket with its version under contracts:manage", async () => {
    const calls = stub(["admin:accounts", "time:log", "contracts:manage"]);
    renderDesk(<BucketsPanel accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByText("Edit"));
    const form = within(await screen.findByRole("form", { name: "Edit Governance" }));
    fireEvent.change(form.getByLabelText("Status"), { target: { value: "retired" } });
    fireEvent.change(form.getByLabelText("Taxonomy"), { target: { value: "account_mgmt" } });
    fireEvent.click(form.getByText("Save bucket"));
    await waitFor(() => expect(calls.some((call) => call.key === PATCH)).toBe(true));
    expect(calls.find((call) => call.key === PATCH)?.body).toEqual({
      version: 1,
      label: "Governance",
      code: "account_mgmt",
      billable_class: "non_billable",
      status: "retired",
    });
  });

  it("words a class the account's catalog does not carry", async () => {
    stub(["admin:accounts", "time:log", "contracts:manage"], {
      [PATCH]: () => json({ code: "unknown_billable_class" }, 400),
    });
    renderDesk(<BucketsPanel accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByText("Edit"));
    const form = within(await screen.findByRole("form", { name: "Edit Governance" }));
    fireEvent.click(form.getByText("Save bucket"));
    await screen.findByText("That class is not in this account's catalog.");
  });

  it("says so when the account has no bucket", async () => {
    stub(["admin:accounts", "time:log"], { [BUCKETS]: () => json([]) });
    renderDesk(<BucketsPanel accountId={ACCOUNT_ID} />);
    await screen.findByText("This account has no non-ticket buckets.");
  });
});
