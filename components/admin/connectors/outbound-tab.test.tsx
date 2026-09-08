import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminConnectorRecordPage from "@/app/(internal)/admin/connectors/[id]/page";
import { OutboundTab, statusFromSearch } from "@/components/admin/connectors/outbound-tab";
import { aConflictOutcome, aHealthRow, anInstance, anOutboundRow } from "@/redux/connectorsApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const ID = anInstance().id;

const navigation = vi.hoisted(() => ({
  search: "",
  pathname: `/admin/connectors/11111111-1111-4111-8111-111111111111`,
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigation.search),
  useParams: () => ({ id: "11111111-1111-4111-8111-111111111111" }),
}));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["acct-1"], permissions } });

describe("OutboundTab", () => {
  beforeEach(() => {
    navigation.search = "";
    navigation.replace.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lists the queue with the event, the ticket, the status and the backoff", async () => {
    stubFetch({
      [`GET /v1/connectors/${ID}/outbound`]: () =>
        json([
          anOutboundRow(),
          anOutboundRow({
            id: "55555555-5555-4555-8555-555555555552",
            event: "work_note.created",
            status: "dead_lettered",
            attempts: 6,
            last_error: "HTTP 401 from the instance",
          }),
        ]),
    });
    renderDesk(<OutboundTab instanceId={ID} />);
    await screen.findByText("Ticket updated");
    expect(screen.getByText("Work note")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "CS0000042" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "CS0000042" })[0]).toHaveAttribute("href", "/tickets/CS0000042");
    // The status words also name the filter's options, so the pills are read
    // by the signal tone they carry.
    const pill = (label: string) => screen.getAllByText(label).find((element) => element.hasAttribute("data-state"));
    expect(pill("Pending")).toHaveAttribute("data-state", "ready");
    expect(pill("Dead lettered")).toHaveAttribute("data-state", "overdue");
    expect(screen.getByText("HTTP 401 from the instance")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("reads the status filter from the URL and sends it to the API", async () => {
    navigation.search = "tab=outbound&status=failed";
    const calls = stubFetch({
      [`GET /v1/connectors/${ID}/outbound`]: () => json([anOutboundRow({ status: "failed", attempts: 2 })]),
    });
    renderDesk(<OutboundTab instanceId={ID} />);
    await screen.findByText("Failed");
    expect(calls[0].search).toBe("?status=failed");
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("failed");
  });

  it("writes the chosen status into the URL and keeps the tab there", async () => {
    navigation.search = "tab=outbound";
    stubFetch({ [`GET /v1/connectors/${ID}/outbound`]: () => json([]) });
    renderDesk(<OutboundTab instanceId={ID} />);
    await screen.findByText(/Nothing has been queued/);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "dead_lettered" } });
    expect(navigation.replace).toHaveBeenCalledWith(`${navigation.pathname}?tab=outbound&status=dead_lettered`);
  });

  it("ignores a status the queue does not keep", () => {
    expect(statusFromSearch(new URLSearchParams("status=nowhere"))).toBeUndefined();
    expect(statusFromSearch(new URLSearchParams(""))).toBeUndefined();
    expect(statusFromSearch(new URLSearchParams("status=skipped"))).toBe("skipped");
  });

  it("retries a settled row and says what the API did with it", async () => {
    const row = anOutboundRow({ status: "failed", attempts: 3, last_error: "HTTP 503 from the instance" });
    const calls = stubFetch({
      [`GET /v1/connectors/${ID}/outbound`]: () => json([row]),
      [`POST /v1/connectors/${ID}/outbound/${row.id}/retry`]: () => json({ id: row.id, outcome: "requeued" }, 201),
    });
    renderDesk(<OutboundTab instanceId={ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry CS0000042" }));
    await screen.findByText("The change is back in the queue and goes out on the next dispatch.");
    expect(calls.some((call) => call.key === `POST /v1/connectors/${ID}/outbound/${row.id}/retry`)).toBe(true);
  });

  it("offers no retry on a row that has not settled as a failure", async () => {
    stubFetch({
      [`GET /v1/connectors/${ID}/outbound`]: () => json([anOutboundRow({ status: "sent", sent_at: null })]),
    });
    renderDesk(<OutboundTab instanceId={ID} />);
    await screen.findByText("Ticket updated");
    expect(screen.queryByRole("button", { name: /Retry/ })).not.toBeInTheDocument();
  });

  it("shows the kept and dropped fields of a conflict on expand", async () => {
    stubFetch({
      [`GET /v1/connectors/${ID}/outbound`]: () =>
        json([anOutboundRow({ status: "skipped", conflict: aConflictOutcome() })]),
    });
    renderDesk(<OutboundTab instanceId={ID} />);
    const summary = await screen.findByText("The last push kept short_description and dropped client_notes.");
    fireEvent.click(summary);
    expect(screen.getByText("short_description")).toHaveAttribute("data-kept", "short_description");
    expect(screen.getByText(/ServiceNow owns this field/)).toBeInTheDocument();
  });

  it("says a row was never contested when the worker recorded nothing", async () => {
    stubFetch({ [`GET /v1/connectors/${ID}/outbound`]: () => json([anOutboundRow({ status: "sent" })]) });
    renderDesk(<OutboundTab instanceId={ID} />);
    await screen.findByText("Ticket updated");
    expect(screen.getByText("none")).toBeInTheDocument();
  });
});

describe("the connector record's Outbound tab", () => {
  beforeEach(() => {
    navigation.search = "";
    navigation.replace.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without admin:connectors and asks the API for nothing", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["admin:accounts"]) });
    renderDesk(<AdminConnectorRecordPage />);
    await screen.findByText("Not permitted");
    expect(calls.some((call) => call.key.includes("/v1/connectors"))).toBe(false);
  });

  it("opens the queue from the URL and never calls it from another tab", async () => {
    navigation.search = "tab=outbound&status=pending";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:connectors"]),
      "GET /v1/connectors/health": () => json([aHealthRow({ mode: "bidirectional", pending_outbound: 2 })]),
      [`GET /v1/connectors/${ID}/outbound`]: () => json([anOutboundRow()]),
    });
    renderDesk(<AdminConnectorRecordPage />);
    await screen.findByText("Ticket updated");
    expect(calls.find((call) => call.key === `GET /v1/connectors/${ID}/outbound`)?.search).toBe("?status=pending");
    fireEvent.click(screen.getByRole("tab", { name: /Runs/ }));
    expect(navigation.replace).toHaveBeenCalledWith(`${navigation.pathname}?tab=runs`);
  });
});
