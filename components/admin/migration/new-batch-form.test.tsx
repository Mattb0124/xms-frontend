import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewBatchForm } from "@/components/admin/migration/new-batch-form";
import { anInstance } from "@/redux/connectorsApi.test";
import { ACCOUNT_ID, INSTANCE_ID, aBatch } from "@/redux/migrationApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/migration/new" }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

const accounts = [
  { id: ACCOUNT_ID, name: "Brookfield" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Austral Mining" },
];

function fillRange(from: string, to: string) {
  fireEvent.change(screen.getByLabelText("Opened from"), { target: { value: from } });
  fireEvent.change(screen.getByLabelText("Opened to"), { target: { value: to } });
}

describe("NewBatchForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the chosen account's instances and posts the contract body with the dry run flag", async () => {
    const onCreated = vi.fn();
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:migration", "admin:connectors"]),
      [`GET /v1/accounts/${ACCOUNT_ID}/connectors`]: () =>
        json([anInstance({ id: INSTANCE_ID, account_id: ACCOUNT_ID })]),
      "POST /v1/migration/batches": () => json(aBatch(), 201),
    });
    renderDesk(<NewBatchForm accounts={accounts} onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText("Account"), { target: { value: ACCOUNT_ID } });
    await screen.findByRole("option", { name: "Brookfield CSM (sn_customerservice_case)" });
    fireEvent.change(screen.getByLabelText("Instance"), { target: { value: INSTANCE_ID } });
    fillRange("2025-01-01", "2025-12-31");
    expect(screen.getByRole("switch", { name: /Dry run/ })).toBeChecked();
    fireEvent.click(screen.getByRole("switch", { name: /Dry run/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create batch" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(calls.find((call) => call.key === "POST /v1/migration/batches")?.body).toEqual({
      account_id: ACCOUNT_ID,
      instance_id: INSTANCE_ID,
      object_kind: "case",
      opened_from: "2025-01-01",
      opened_to: "2025-12-31",
      dry_run: false,
    });
    expect(screen.getByRole("option", { name: "Contacts (Phase 3)" })).toBeDisabled();
  });

  it("refuses a reversed range before asking the server, and shows the server's refusals inline", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:migration", "admin:connectors"]),
      [`GET /v1/accounts/${ACCOUNT_ID}/connectors`]: () =>
        json([anInstance({ id: INSTANCE_ID, account_id: ACCOUNT_ID, active_field_map_id: null })]),
      "POST /v1/migration/batches": () => json({ code: "no_active_field_map" }, 409),
    });
    renderDesk(<NewBatchForm accounts={accounts} initial={{ account_id: ACCOUNT_ID }} onCreated={vi.fn()} />);
    await screen.findByRole("option", { name: "Brookfield CSM (sn_customerservice_case), no active field map" });
    fireEvent.change(screen.getByLabelText("Instance"), { target: { value: INSTANCE_ID } });
    fillRange("2025-12-31", "2025-01-01");
    expect(screen.getByRole("alert")).toHaveTextContent("The end of the range is before its start.");
    expect(screen.getByRole("button", { name: "Create batch" })).toBeDisabled();
    fillRange("2025-01-01", "2025-12-31");
    fireEvent.click(screen.getByRole("button", { name: "Create batch" }));
    await screen.findByText(/no active field map. Activate one on the connector record first/);
    expect(calls.filter((call) => call.key === "POST /v1/migration/batches")).toHaveLength(1);
  });

  it("falls back to a typed instance id without admin:connectors and carries the superseded batch", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:migration"]),
      "POST /v1/migration/batches": () => json(aBatch(), 201),
    });
    renderDesk(
      <NewBatchForm
        accounts={accounts}
        initial={{
          account_id: ACCOUNT_ID,
          instance_id: INSTANCE_ID,
          opened_from: "2025-01-01",
          opened_to: "2025-12-31",
          supersedes_batch_id: aBatch().id,
        }}
        onCreated={vi.fn()}
      />,
    );
    await screen.findByText(/needs admin:connectors/);
    expect(screen.getByLabelText("Instance")).toHaveValue(INSTANCE_ID);
    fireEvent.click(screen.getByRole("button", { name: "Create batch" }));
    await waitFor(() =>
      expect(calls.find((call) => call.key === "POST /v1/migration/batches")?.body).toMatchObject({
        instance_id: INSTANCE_ID,
        supersedes_batch_id: aBatch().id,
        dry_run: true,
      }),
    );
    expect(calls.some((call) => call.key.startsWith("GET /v1/accounts/"))).toBe(false);
  });
});
