import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accountLabel,
  AUDIT_FIELDS,
  AuditSearch,
  operatorLabel,
  operatorsFor,
  rowsToQuery,
  scopeOf,
} from "@/components/admin/audit-search";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { anAuditEvent, anOperatorAuditRow, aSavedQuery, aSavedQueryPage, SAVED_QUERY_ID } from "@/test-kit/reporting";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/audit" }));

const downloadFile = vi.fn();
vi.mock("@/lib/exports/download", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exports/download")>();
  return { ...actual, downloadFile: (request: unknown) => downloadFile(request) };
});

const me = (permissions: string[]) => ({
  principal: { kind: "internal", userId: "user-ada", accountIds: [], permissions },
});

describe("rowsToQuery", () => {
  it("drops empty rows, splits lists and sends dates as ISO", () => {
    expect(
      rowsToQuery([
        { field: "stream", op: "eq", value: "security" },
        { field: "event_type", op: "contains", value: "" },
        { field: "outcome", op: "in", value: "denied, failed" },
        { field: "occurred_at", op: "after", value: "2026-09-01T00:00" },
      ]),
    ).toEqual([
      { field: "stream", op: "eq", value: "security" },
      { field: "outcome", op: "in", value: ["denied", "failed"] },
      { field: "occurred_at", op: "after", value: new Date("2026-09-01T00:00").toISOString() },
    ]);
  });
});

describe("AuditSearch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    downloadFile.mockReset();
  });

  it("posts the conditions, lists the events, opens the record drawer and pivots to the request", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read", "audit:export"])),
      "POST /v1/audit/search": (body) => {
        const parsed = JSON.parse(body ?? "{}") as { conditions: Array<{ field: string }>; cursor?: string };
        if (parsed.cursor)
          return json({ items: [anAuditEvent({ id: "ev-3", request_id: "req-9" })], next_cursor: null });
        if (parsed.conditions[0]?.field === "request_id") {
          return json({
            items: [
              anAuditEvent(),
              anAuditEvent({ id: "ev-2", stream: "usage", event_type: "api.request", attrs: null }),
            ],
            next_cursor: null,
          });
        }
        return json({ items: [anAuditEvent()], next_cursor: "c1" });
      },
    });
    renderDesk(<AuditSearch />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "security" } });
    fireEvent.click(screen.getByText("+ Add condition"));
    const rows = screen.getAllByLabelText("Field");
    fireEvent.change(rows[1], { target: { value: "outcome" } });
    fireEvent.change(screen.getAllByLabelText("Value")[1], { target: { value: "denied" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("ticket.transitioned")).toBeInTheDocument());
    const search = calls.find((call) => call.key === "POST /v1/audit/search");
    expect(search?.body).toEqual({
      conditions: [
        { field: "stream", op: "eq", value: "security" },
        { field: "outcome", op: "eq", value: "denied" },
      ],
      limit: 100,
    });

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("req-9")).toBeInTheDocument());
    const more = calls.filter((call) => call.key === "POST /v1/audit/search")[1];
    expect(more.body).toMatchObject({ cursor: "c1" });

    fireEvent.click(screen.getAllByRole("row").find((row) => row.textContent?.includes("Cara Lee"))!);
    const drawer = await screen.findByRole("dialog", { name: "Event record" });
    expect(within(drawer).getByTestId("attrs-old")).toHaveTextContent('"state": "new"');
    expect(within(drawer).getByTestId("attrs-new")).toHaveTextContent('"state": "assigned"');
    expect(within(drawer).getByText("req-1")).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole("button", { name: "Show this request" }));
    await waitFor(() => expect(screen.getByText("api.request")).toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const pivot = calls.filter((call) => call.key === "POST /v1/audit/search").at(-1);
    expect(pivot?.body).toEqual({ conditions: [{ field: "request_id", op: "eq", value: "req-1" }], limit: 100 });
    expect(screen.getByLabelText("Field")).toHaveValue("request_id");
    expect(screen.getByLabelText("Value")).toHaveValue("req-1");

    downloadFile.mockResolvedValue({ blob: new Blob(), fileName: "events.csv", rowCount: null });
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(screen.getByText("Events exported")).toBeInTheDocument());
    expect(downloadFile).toHaveBeenCalledWith({
      url: "/v1/audit/export",
      method: "POST",
      body: { conditions: [{ field: "request_id", op: "eq", value: "req-1" }] },
      fallbackName: "events.csv",
    });
  });

  it("reads an operator-scope row as Portfolio with the Operator chip, and an account row as its account", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "POST /v1/audit/search": () =>
        json({ items: [anOperatorAuditRow(), anAuditEvent({ account_id: "acct-77" })], next_cursor: null }),
    });
    renderDesk(<AuditSearch />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("role.permissions_changed")).toBeInTheDocument());
    const operator = screen.getAllByRole("row").find((row) => row.textContent?.includes("role.permissions_changed"))!;
    expect(within(operator).getByText("Portfolio")).toHaveAttribute("data-account", "portfolio");
    expect(within(operator).getByText("Operator")).toHaveAttribute("data-scope", "operator");

    // The account row keeps its account and is never chipped as operator.
    const account = screen.getAllByRole("row").find((row) => row.textContent?.includes("ticket.transitioned"))!;
    expect(within(account).getByText("acct-77")).toHaveAttribute("data-account", "acct-77");
    expect(within(account).queryByText("Operator")).not.toBeInTheDocument();

    // The drawer names the scope and the portfolio too, so the envelope's
    // empty account is never read as an account that went missing.
    fireEvent.click(operator);
    const drawer = await screen.findByRole("dialog", { name: "Event record" });
    expect(within(drawer).getByText("Operator")).toBeInTheDocument();
    expect(within(drawer).getByText("Portfolio")).toBeInTheDocument();
  });

  it("reads the scope off the attribute the server sent and nothing else", () => {
    expect(scopeOf(anOperatorAuditRow())).toBe("operator");
    expect(scopeOf(anAuditEvent())).toBeNull();
    // A null account is not on its own an operator record: the security
    // stream carries portfolio-wide rows with no scope attribute at all.
    expect(scopeOf(anAuditEvent({ account_id: null, attrs: null }))).toBeNull();
    expect(scopeOf(anAuditEvent({ attrs: { scope: 42 } }))).toBeNull();
    expect(accountLabel(anAuditEvent({ account_id: null }))).toBe("Portfolio");
    expect(accountLabel(anAuditEvent({ account_id: "acct-12345678900" }))).toBe("acct-123");
  });

  /**
   * The Portfolio-wide filter (backend c16f7f0). The pair is offered on the
   * nullable columns of `rpt.events_v` and nowhere else, because the API
   * refuses a null test on a column every branch of the view writes.
   */
  it("offers the two null tests on the nullable fields alone, worded for the field", () => {
    const nullable = AUDIT_FIELDS.filter((field) => operatorsFor(field).includes("is_null")).map((field) => field.key);
    expect(nullable).toEqual([
      "actor_id",
      "principal_kind",
      "account_id",
      "entity_kind",
      "entity_id",
      "request_id",
      "correlation_id",
    ]);
    const account = AUDIT_FIELDS.find((field) => field.key === "account_id")!;
    expect(operatorLabel(account, "is_null")).toBe("is Portfolio-wide");
    expect(operatorLabel(account, "is_not_null")).toBe("is any account");
    expect(operatorsFor(AUDIT_FIELDS.find((field) => field.key === "stream")!)).not.toContain("is_null");
    expect(operatorsFor(AUDIT_FIELDS.find((field) => field.key === "occurred_at")!)).toEqual(["after", "before"]);
  });

  it("sends a null test with no value, and still drops an empty value on every other operator", () => {
    expect(
      rowsToQuery([
        { field: "account_id", op: "is_null", value: "left over from the last operator" },
        { field: "actor_id", op: "is_not_null", value: "" },
        { field: "account_id", op: "eq", value: "" },
      ]),
    ).toEqual([
      { field: "account_id", op: "is_null" },
      { field: "actor_id", op: "is_not_null" },
    ]);
  });

  it("asks the API for the portfolio-wide rows, with no value box to fill in", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "POST /v1/audit/search": () => json({ items: [anOperatorAuditRow()], next_cursor: null }),
    });
    renderDesk(<AuditSearch initialRows={[{ field: "account_id", op: "eq", value: "" }]} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Operator"), { target: { value: "is_null" } });
    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("role.permissions_changed")).toBeInTheDocument());
    expect(calls.find((call) => call.key === "POST /v1/audit/search")?.body).toEqual({
      conditions: [{ field: "account_id", op: "is_null" }],
      limit: 100,
    });
  });

  it("hides Export CSV without audit:export", async () => {
    stubFetch({ "GET /v1/admin/me": () => json(me(["audit:read"])) });
    renderDesk(<AuditSearch />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
  });

  it("runs a saved query into the results and pages it through the run route, not the inline search", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/audit/saved-queries": () => json([aSavedQuery()]),
      [`POST /v1/audit/saved-queries/${SAVED_QUERY_ID}/run`]: (body) => {
        const parsed = JSON.parse(body ?? "{}") as { cursor?: string };
        return json(
          parsed.cursor
            ? aSavedQueryPage({ items: [anAuditEvent({ id: "ev-saved-2", event_type: "role.created" })] })
            : aSavedQueryPage({ next_cursor: "cur-2" }),
          201,
        );
      },
    });
    renderDesk(<AuditSearch />);

    await waitFor(() => expect(screen.getByText("Brookfield changes")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    // The results name the query they came from rather than a bare count.
    await waitFor(() => expect(screen.getAllByText("1 loaded from Brookfield changes").length).toBeGreaterThan(0));
    expect(screen.getByText("account.updated")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("role.created")).toBeInTheDocument());
    // Two runs of the saved query, and the inline search was never asked.
    const runs = calls.filter((call) => call.key.endsWith("/run"));
    expect(runs).toHaveLength(2);
    expect(runs.at(-1)!.body).toEqual({ limit: 100, cursor: "cur-2" });
    expect(calls.some((call) => call.key === "POST /v1/audit/search")).toBe(false);
  });

  it("goes back to the inline search once the reader searches again", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/audit/saved-queries": () => json([aSavedQuery()]),
      [`POST /v1/audit/saved-queries/${SAVED_QUERY_ID}/run`]: () =>
        json(aSavedQueryPage({ next_cursor: "cur-2" }), 201),
      "POST /v1/audit/search": () => json({ items: [anAuditEvent()], next_cursor: null }),
    });
    renderDesk(<AuditSearch />);

    await waitFor(() => expect(screen.getByText("Brookfield changes")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(screen.getAllByText("1 loaded from Brookfield changes").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(screen.getAllByText("1 loaded").length).toBeGreaterThan(0));
    expect(calls.some((call) => call.key === "POST /v1/audit/search")).toBe(true);
  });

  it("loads a saved query into the builder without running it", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": () => json(me(["audit:read"])),
      "GET /v1/audit/saved-queries": () => json([aSavedQuery()]),
    });
    renderDesk(<AuditSearch />);

    await waitFor(() => expect(screen.getByText("Brookfield changes")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Load into builder" }));

    const fields = screen.getAllByLabelText("Field") as HTMLSelectElement[];
    expect(fields.map((field) => field.value)).toEqual(["stream", "account_id"]);
    expect(calls.some((call) => call.key.endsWith("/run"))).toBe(false);
  });
});
