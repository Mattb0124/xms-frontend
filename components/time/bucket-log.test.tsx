import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BucketLog } from "@/components/time/bucket-log";
import { aBucket, anEntry, BUCKET_ID } from "@/redux/timeApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/time" }));

const ACCOUNT_ID = "acct-1";
const BUCKETS = `GET /v1/accounts/${ACCOUNT_ID}/buckets`;
const LOG = `POST /v1/accounts/${ACCOUNT_ID}/buckets/${BUCKET_ID}/time-entries`;

const me = () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions: ["time:log"] } });

const accounts = () => json([{ id: ACCOUNT_ID, key: "BRK", name: "Brookfield", status: "active" }]);

/** The account's own catalogs: the same vocabulary a ticket entry is classed by. */
const catalogs = () =>
  json({
    resolution_codes: [],
    activity_types: [
      { key: "governance", label: "Governance", billable_class: "billable" },
      { key: "client_meeting", label: "Client meeting", billable_class: "billable" },
    ],
    billable_classes: [
      { key: "billable", label: "Billable", consumes_contract: true },
      { key: "non_billable", label: "Non-billable", consumes_contract: false },
    ],
  });

function stub(overrides: Record<string, () => Response> = {}) {
  return stubFetch({
    "GET /v1/admin/me": me,
    "GET /v1/accounts": accounts,
    "GET /v1/catalogs": catalogs,
    [BUCKETS]: () => json([aBucket(), aBucket({ id: "b-old", label: "Old bucket", status: "retired" })]),
    [LOG]: () => json(anEntry({ ticket_id: null, bucket_id: BUCKET_ID, bucket_label: "Governance" }), 201),
    ...overrides,
  });
}

/** The picker offers an account only once the grant list has answered. */
async function chooseAccount() {
  await screen.findByRole("option", { name: "Brookfield" });
  fireEvent.change(screen.getByLabelText("Account"), { target: { value: ACCOUNT_ID } });
}

async function pick() {
  await chooseAccount();
  await screen.findByRole("option", { name: /^Governance/ });
  fireEvent.change(screen.getByLabelText("Bucket"), { target: { value: BUCKET_ID } });
}

/**
 * Non-ticket time on the timesheet (TB-12): the same Log time form, against
 * a bucket rather than a ticket, with the account's own activity taxonomy
 * and the class the bucket carries.
 */
describe("BucketLog", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks for no bucket until an account is chosen", async () => {
    const calls = stub();
    renderDesk(<BucketLog />);
    await screen.findByLabelText("Account");
    expect(screen.queryByLabelText("Bucket")).toBeNull();
    expect(calls.some((call) => call.key === BUCKETS)).toBe(false);
  });

  it("offers the active buckets with their place in the taxonomy, and never a retired one", async () => {
    stub();
    renderDesk(<BucketLog />);
    await chooseAccount();
    expect(await screen.findByRole("option", { name: "Governance (Governance)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Old bucket/ })).toBeNull();
  });

  it("opens the form on the bucket's own class and says whether it burns the contract", async () => {
    const { container } = stubAndRender();
    await pick();
    await waitFor(() => expect(screen.getByLabelText("Billable class")).toHaveValue("non_billable"));
    expect(container.querySelector("[data-bucket-class]")?.textContent).toContain("does not consume the contract");
  });

  it("logs the entry against the bucket with the activity the account's catalog names", async () => {
    const calls = stub();
    renderDesk(<BucketLog />);
    await pick();
    await screen.findByLabelText("Minutes");
    fireEvent.change(screen.getByLabelText("Minutes"), { target: { value: "45" } });
    fireEvent.change(screen.getByLabelText("Activity"), { target: { value: "client_meeting" } });
    fireEvent.click(screen.getByText("Log time"));
    await waitFor(() => expect(calls.some((call) => call.key === LOG)).toBe(true));
    expect(calls.find((call) => call.key === LOG)?.body).toMatchObject({
      minutes: 45,
      activity_type: "client_meeting",
    });
  });

  it("words a bucket the API retired underneath the form", async () => {
    stub({ [LOG]: () => json({ code: "bucket_retired" }, 409) });
    renderDesk(<BucketLog />);
    await pick();
    await screen.findByLabelText("Minutes");
    fireEvent.change(screen.getByLabelText("Minutes"), { target: { value: "30" } });
    fireEvent.click(screen.getByText("Log time"));
    await screen.findByText(/has been retired/);
  });

  it("says so when the account has no bucket at all", async () => {
    stub({ [BUCKETS]: () => json([]) });
    renderDesk(<BucketLog />);
    await chooseAccount();
    await screen.findByText("This account has no bucket to log against.");
  });
});

/** Renders with the default stub and hands back the container for a data attribute check. */
function stubAndRender() {
  stub();
  return renderDesk(<BucketLog />);
}
