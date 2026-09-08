import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rowsFromConditions } from "@/components/admin/audit-search";
import { SavedQueriesPanel } from "@/components/admin/saved-queries";
import {
  describeSavedQueryError,
  QUERY_NEEDS_CONDITIONS,
  QUERY_NAME_REQUIRED,
  savedQueryLine,
  SHARING_NEEDS_EXPORT,
  validateSavedQuery,
} from "@/lib/reporting/saved-queries";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aSavedQuery, aSavedQueryPage, QUERY_OWNER_ID, SAVED_QUERY_ID } from "@/test-kit/reporting";
import type { AuditCondition } from "@/redux/reportingApi";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/audit" }));

const me = (permissions: string[], userId = QUERY_OWNER_ID) => ({
  principal: { kind: "internal", userId, accountIds: [], permissions },
});

const CONDITIONS: AuditCondition[] = [{ field: "stream", op: "eq", value: "security" }];

const panel = (overrides: Partial<Parameters<typeof SavedQueriesPanel>[0]> = {}) => (
  <SavedQueriesPanel conditions={CONDITIONS} onRan={() => {}} onLoad={() => {}} {...overrides} />
);

const list = () => screen.getByTestId("saved-queries");

describe("the saved query vocabulary", () => {
  it("says how many conditions a query carries, who saved it and who else has it", () => {
    expect(savedQueryLine(aSavedQuery(), QUERY_OWNER_ID)).toBe("2 conditions, private, saved by You");
    expect(savedQueryLine(aSavedQuery({ shared: true }), "user-quinn")).toBe(
      "2 conditions, shared, saved by Ada Byron",
    );
  });

  it("refuses a nameless query and one with nothing in the builder", () => {
    expect(validateSavedQuery({ name: "", description: "", shared: false }, [])).toEqual([
      QUERY_NAME_REQUIRED,
      QUERY_NEEDS_CONDITIONS,
    ]);
    expect(validateSavedQuery({ name: "Denials", description: "", shared: false }, CONDITIONS)).toEqual([]);
  });

  it("names the permission sharing needs and does not claim a missing query was forbidden", () => {
    expect(describeSavedQueryError("forbidden", undefined, "audit:export")).toBe(SHARING_NEEDS_EXPORT);
    const gone = describeSavedQueryError("not_found");
    expect(gone).toContain("no longer there");
    expect(gone).not.toContain("forbidden");
    expect(describeSavedQueryError("invalid_conditions", ["condition 0: is_null needs a nullable field"])).toContain(
      "is_null needs a nullable field",
    );
  });
});

describe("rowsFromConditions", () => {
  it("reads a saved query back into the builder, list and null test included", () => {
    expect(
      rowsFromConditions([
        { field: "stream", op: "eq", value: "security" },
        { field: "outcome", op: "in", value: ["denied", "failed"] },
        { field: "account_id", op: "is_null" },
      ]),
    ).toEqual([
      { field: "stream", op: "eq", value: "security" },
      { field: "outcome", op: "in", value: "denied, failed" },
      { field: "account_id", op: "is_null", value: "" },
    ]);
  });
});

describe("SavedQueriesPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves the builder's conditions under a name, shared when the reader may share", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read", "audit:export"])),
      "GET /v1/audit/saved-queries": () => json([]),
      "POST /v1/audit/saved-queries": (body) =>
        json(aSavedQuery({ name: (JSON.parse(body ?? "{}") as { name: string }).name }), 201),
    });
    renderDesk(panel());

    await waitFor(() => expect(screen.getByText(/No saved queries yet/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Save these conditions" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Every denial" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Denials across the streams" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(calls.some((call) => call.key === "POST /v1/audit/saved-queries")).toBe(true));
    expect(calls.find((call) => call.key === "POST /v1/audit/saved-queries")!.body).toEqual({
      name: "Every denial",
      description: "Denials across the streams",
      shared: true,
      conditions: CONDITIONS,
    });
  });

  it("does not offer sharing without audit:export, and says which key it needs", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/audit/saved-queries": () => json([]),
    });
    renderDesk(panel());

    await waitFor(() => expect(screen.getByRole("button", { name: "Save these conditions" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Save these conditions" }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText(SHARING_NEEDS_EXPORT)).toBeInTheDocument();
  });

  it("refuses an empty builder before the API is asked", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/audit/saved-queries": () => json([]),
    });
    renderDesk(panel({ conditions: [] }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Save these conditions" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Save these conditions" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Everything" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText(QUERY_NEEDS_CONDITIONS)).toBeInTheDocument());
    expect(calls.some((call) => call.key === "POST /v1/audit/saved-queries")).toBe(false);
  });

  it("runs one through its own route and hands the page and the query back", async () => {
    const onRan = vi.fn();
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/audit/saved-queries": () => json([aSavedQuery()]),
      [`POST /v1/audit/saved-queries/${SAVED_QUERY_ID}/run`]: () => json(aSavedQueryPage(), 201),
    });
    renderDesk(panel({ onRan }));

    await waitFor(() => expect(screen.getByText("Brookfield changes")).toBeInTheDocument());
    expect(within(list()).getByText(/2 conditions, private, saved by You/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => expect(onRan).toHaveBeenCalled());
    expect(onRan.mock.calls[0][0].saved_query.name).toBe("Brookfield changes");
    expect(calls.find((call) => call.key.endsWith("/run"))!.body).toEqual({ limit: 100 });
  });

  it("loads one back into the builder without running it", async () => {
    const onLoad = vi.fn();
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/audit/saved-queries": () => json([aSavedQuery()]),
    });
    renderDesk(panel({ onLoad }));

    await waitFor(() => expect(screen.getByText("Brookfield changes")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Load into builder" }));
    expect(onLoad).toHaveBeenCalledWith(aSavedQuery());
    expect(calls.some((call) => call.key.endsWith("/run"))).toBe(false);
  });

  it("renames and deletes the reader's own query and leaves someone else's alone", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/audit/saved-queries": () =>
        json([
          aSavedQuery(),
          aSavedQuery({ id: "other", name: "Quinn's denials", owner_user_id: "user-quinn", shared: true }),
        ]),
      [`PATCH /v1/audit/saved-queries/${SAVED_QUERY_ID}`]: () => json(aSavedQuery({ name: "Brookfield audit" })),
      [`DELETE /v1/audit/saved-queries/${SAVED_QUERY_ID}`]: () => json({ deleted: true }),
    });
    renderDesk(panel());

    await waitFor(() => expect(screen.getByText("Quinn's denials")).toBeInTheDocument());
    // Editing is the owner's alone, so the other row offers neither control.
    const theirs = within(list()).getByText("Quinn's denials").closest("li")!;
    expect(within(theirs).queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    expect(within(theirs).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Brookfield audit" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("PATCH"))).toBe(true));
    expect(calls.find((call) => call.key.startsWith("PATCH"))!.body).toMatchObject({ name: "Brookfield audit" });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("DELETE"))).toBe(true));
  });

  it("words a query that vanished rather than claiming it was forbidden", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/audit/saved-queries": () => json([aSavedQuery()]),
      [`POST /v1/audit/saved-queries/${SAVED_QUERY_ID}/run`]: () => json({ code: "not_found" }, 404),
    });
    renderDesk(panel());

    await waitFor(() => expect(screen.getByText("Brookfield changes")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(screen.getByText(/no longer there/)).toBeInTheDocument());
    expect(screen.getByText(/stopped sharing it/)).toBeInTheDocument();
  });
});
