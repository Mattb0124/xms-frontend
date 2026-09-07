import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditSearch, rowsToQuery } from "@/components/admin/audit-search";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { anAuditEvent } from "@/test-kit/reporting";

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

  it("hides Export CSV without audit:export", async () => {
    stubFetch({ "GET /v1/admin/me": () => json(me(["audit:read"])) });
    renderDesk(<AuditSearch />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
  });
});
