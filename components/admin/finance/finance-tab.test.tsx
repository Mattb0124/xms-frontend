import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountFinanceTab } from "@/components/admin/finance/finance-tab";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aDestination, aFinanceDelivery, BILLING_PERIOD_ID, FINANCE_ACCOUNT_ID } from "@/test-kit/integrations";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/accounts/acct-1" }));

const DESTINATION = `GET /v1/finance/destinations/${FINANCE_ACCOUNT_ID}`;
const SET_DESTINATION = `PUT /v1/finance/destinations/${FINANCE_ACCOUNT_ID}`;
const DELIVERIES = "GET /v1/finance/deliveries";
const DELIVER = "POST /v1/finance/deliveries";
const PERIODS = `GET /v1/accounts/${FINANCE_ACCOUNT_ID}/billing-periods`;

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [FINANCE_ACCOUNT_ID], permissions } });

const aPeriod = (overrides: Record<string, unknown> = {}) => ({
  id: BILLING_PERIOD_ID,
  account_id: FINANCE_ACCOUNT_ID,
  starts_on: "2026-08-01",
  ends_on: "2026-08-31",
  status: "locked",
  submitted_at: null,
  submitted_by: null,
  approved_at: null,
  approved_by: null,
  locked_at: "2026-09-01T22:00:00Z",
  locked_by: "u1",
  submitted_by_name: null,
  approved_by_name: null,
  locked_by_name: "Cara Lee",
  auto_lock_at: null,
  summary: null,
  checksum: null,
  version: 4,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-09-01T22:00:00Z",
  ...overrides,
});

describe("AccountFinanceTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed on each half and never asks the API", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["admin:accounts", "tickets:view"]) });
    renderDesk(<AccountFinanceTab accountId={FINANCE_ACCOUNT_ID} />);
    await screen.findByText(/not where its locked billing exports are delivered/);
    expect(screen.getByText(/belong to whoever locks the billing periods/)).toBeInTheDocument();
    expect(calls.some((call) => call.key === DESTINATION || call.key === DELIVERIES)).toBe(false);
  });

  it("saves an HTTPS destination with the body the API takes and shows the secret once", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:connectors"]),
      [DESTINATION]: () => json(null),
      [SET_DESTINATION]: () => json({ ...aDestination(), secret: "whsec_only_once" }),
    });
    renderDesk(<AccountFinanceTab accountId={FINANCE_ACCOUNT_ID} />);
    const form = await screen.findByRole("form", { name: "Finance destination" });
    expect(within(form).getByText(/mints a signing secret, shown once/)).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText("Endpoint URL"), {
      target: { value: "https://finance.example.test/xms/billing" },
    });
    fireEvent.change(within(form).getByLabelText("Format"), { target: { value: "xlsx" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save destination" }));

    await waitFor(() =>
      expect(calls.find((call) => call.key === SET_DESTINATION)?.body).toEqual({
        kind: "https",
        endpoint_url: "https://finance.example.test/xms/billing",
        format: "xlsx",
        enabled: true,
      }),
    );
    const once = await screen.findByTestId("new-finance-secret");
    expect(within(once).getByText("whsec_only_once")).toBeInTheDocument();
    expect(once).toHaveTextContent("It will not be shown again");
    fireEvent.click(screen.getByRole("button", { name: "I have stored it" }));
    await waitFor(() => expect(screen.queryByTestId("new-finance-secret")).not.toBeInTheDocument());
  });

  it("sends the prefix and no endpoint for an object store destination, and no secret comes back", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:connectors"]),
      [DESTINATION]: () => json(aDestination()),
      [SET_DESTINATION]: () =>
        json(
          aDestination({ kind: "object_store", endpoint_url: null, object_prefix: "finance/xms", secret_kid: null }),
        ),
    });
    renderDesk(<AccountFinanceTab accountId={FINANCE_ACCOUNT_ID} />);
    const form = await screen.findByRole("form", { name: "Finance destination" });
    // The record seeds the form: the endpoint and the signing key in force.
    expect(within(form).getByLabelText("Endpoint URL")).toHaveValue("https://finance.example.test/xms/billing");
    expect(form.querySelector("[data-secret-kid]")).toHaveTextContent("Signing key kid-2026-08");

    fireEvent.click(within(form).getByRole("radio", { name: /Object store/ }));
    fireEvent.change(within(form).getByLabelText("Object prefix"), { target: { value: "finance/xms" } });
    fireEvent.click(within(form).getByRole("checkbox", { name: /Enabled/ }));
    fireEvent.click(within(form).getByRole("button", { name: "Save destination" }));

    await waitFor(() =>
      expect(calls.find((call) => call.key === SET_DESTINATION)?.body).toEqual({
        kind: "object_store",
        object_prefix: "finance/xms",
        format: "csv",
        enabled: false,
      }),
    );
    expect(screen.queryByTestId("new-finance-secret")).not.toBeInTheDocument();
  });

  it("words the three refusals the destination route makes", async () => {
    let body: { code: string; problem?: string } = { code: "invalid_endpoint", problem: "not_https" };
    stubFetch({
      "GET /v1/admin/me": me(["admin:connectors"]),
      [DESTINATION]: () => json(null),
      [SET_DESTINATION]: () => json(body, 400),
    });
    renderDesk(<AccountFinanceTab accountId={FINANCE_ACCOUNT_ID} />);
    const form = await screen.findByRole("form", { name: "Finance destination" });
    const save = within(form).getByRole("button", { name: "Save destination" });

    fireEvent.click(save);
    expect(await within(form).findByText(/the endpoint must be an https address/)).toBeInTheDocument();

    body = { code: "endpoint_required" };
    fireEvent.click(save);
    expect(await within(form).findByText("An HTTPS destination needs an endpoint URL.")).toBeInTheDocument();

    body = { code: "prefix_required" };
    fireEvent.click(within(form).getByRole("radio", { name: /Object store/ }));
    fireEvent.click(save);
    expect(await within(form).findByText("An object store destination needs a prefix.")).toBeInTheDocument();
  });

  it("lists the deliveries with the status pill, the acknowledgement, the response, the error and the supersedes marker", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["time:lock-period", "contracts:view"]),
      [PERIODS]: () => json([aPeriod()]),
      [DELIVERIES]: () =>
        json([
          aFinanceDelivery({ id: "del-2", status: "superseded", supersedes_id: "del-0000aaaa" }),
          aFinanceDelivery(),
          aFinanceDelivery({
            id: "del-3",
            status: "failed",
            destination_kind: "object_store",
            manifest_key: null,
            response_status: 503,
            ack_received_at: null,
            ack_reference: null,
            error: "the endpoint timed out",
          }),
        ]),
    });
    renderDesk(<AccountFinanceTab accountId={FINANCE_ACCOUNT_ID} />);
    const table = await screen.findByRole("table", { name: "Finance deliveries" });
    const acknowledged = table.querySelector('[data-delivery="del-1"]')!;
    expect(acknowledged).toHaveTextContent("August 2026");
    expect(acknowledged).toHaveTextContent("HTTPS endpoint");
    expect(within(acknowledged as HTMLElement).getByText("Acknowledged")).toHaveAttribute("data-state", "complete");
    expect(acknowledged.querySelector("[data-ack]")).toHaveTextContent("SAP-BATCH-4471 on 2026-09-02 08:05");
    expect(acknowledged.querySelector("[data-response]")).toHaveTextContent("HTTP 202");

    const superseded = table.querySelector('[data-delivery="del-2"]')!;
    expect(within(superseded as HTMLElement).getByText("Superseded")).toHaveAttribute("data-state", "blocked");
    expect(superseded.querySelector("[data-supersedes]")).toHaveTextContent("Supersedes del-0000");

    const failed = table.querySelector('[data-delivery="del-3"]')!;
    expect(within(failed as HTMLElement).getByText("Failed")).toHaveAttribute("data-state", "overdue");
    expect(failed).toHaveTextContent("Object store");
    expect(failed.querySelector("[data-ack]")).toHaveTextContent("Not acknowledged");
    expect(failed.querySelector("[data-error]")).toHaveTextContent("the endpoint timed out");
  });

  it("delivers the chosen locked period with the period id alone", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["time:lock-period", "contracts:view"]),
      [PERIODS]: () =>
        json([aPeriod(), aPeriod({ id: "p-open", starts_on: "2026-09-01", ends_on: "2026-09-30", status: "open" })]),
      [DELIVERIES]: () => json([]),
      [DELIVER]: () => json(aFinanceDelivery({ id: "del-new", status: "delivered", ack_received_at: null }), 201),
    });
    renderDesk(<AccountFinanceTab accountId={FINANCE_ACCOUNT_ID} />);
    const form = await screen.findByRole("form", { name: "Deliver a period" });
    // Only a locked or exported period can be chosen.
    const options = within(form).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("August 2026");
    fireEvent.click(within(form).getByRole("button", { name: "Deliver now" }));
    await screen.findByText("Delivery started");
    expect(calls.find((call) => call.key === DELIVER)?.body).toEqual({ period_id: BILLING_PERIOD_ID });
  });

  it("words period_not_locked and no_destination", async () => {
    let body: { code: string; status?: string } = { code: "period_not_locked", status: "approved" };
    stubFetch({
      "GET /v1/admin/me": me(["time:lock-period", "contracts:view"]),
      [PERIODS]: () => json([aPeriod()]),
      [DELIVERIES]: () => json([]),
      [DELIVER]: () => json(body, 409),
    });
    renderDesk(<AccountFinanceTab accountId={FINANCE_ACCOUNT_ID} />);
    const form = await screen.findByRole("form", { name: "Deliver a period" });
    fireEvent.click(within(form).getByRole("button", { name: "Deliver now" }));
    expect(await screen.findByText("That period is approved and is delivered once it is locked.")).toBeInTheDocument();

    body = { code: "no_destination" };
    fireEvent.click(within(form).getByRole("button", { name: "Deliver now" }));
    expect(
      await screen.findByText("This account has no enabled destination. Set one above, then deliver."),
    ).toBeInTheDocument();
  });

  it("says there is nothing to deliver until a period is locked", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["time:lock-period", "contracts:view"]),
      [PERIODS]: () => json([aPeriod({ status: "open" })]),
      [DELIVERIES]: () => json([]),
    });
    renderDesk(<AccountFinanceTab accountId={FINANCE_ACCOUNT_ID} />);
    expect(await screen.findByText(/No period is locked yet/)).toBeInTheDocument();
    expect(await screen.findByText("Nothing delivered yet.")).toBeInTheDocument();
  });
});
