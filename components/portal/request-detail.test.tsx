import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import { RequestDetail } from "@/components/portal/request-detail";
import { aPortalMe, aPortalTicket, aTimeline, json, renderPortal, stubFetch } from "@/test-kit/portal";

expect.extend(matchers);

vi.mock("next/navigation", () => ({
  usePathname: () => "/portal/requests/CS0001001",
  useRouter: () => ({ push: vi.fn() }),
}));

function routes(
  ticket = aPortalTicket(),
  transitions = [{ to: "cancelled", label: "Cancelled", requires: [], reopen: false }],
) {
  return {
    "GET /v1/portal/me": () => json(aPortalMe()),
    "GET /v1/portal/tickets/CS0001001": () => json(ticket),
    "GET /v1/portal/tickets/CS0001001/timeline": () => json(aTimeline()),
    "GET /v1/portal/tickets/CS0001001/transitions": () => json({ from: ticket.state, transitions }),
  };
}

describe("portal request detail", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the public thread with You for the requester and client-language status rows, never internal fields", async () => {
    stubFetch(routes());
    const { container } = renderPortal(<RequestDetail requestKey="CS0001001" />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Cannot open the consolidation report" })).toBeInTheDocument(),
    );
    expect(screen.getByText("Being worked", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Cara Lee")).toBeInTheDocument();
    expect(screen.getByText(/Being worked at/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/work note|assignee|SLA|in_progress/i);
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });

  it("confirms closure with the record version and marks the solved action", async () => {
    const resolved = aPortalTicket({ state: "resolved", state_label: "Resolved", version: 5 });
    const calls = stubFetch({
      ...routes(resolved, [
        { to: "closed", label: "Closed", requires: [], reopen: false },
        { to: "in_progress", label: "Reopen", requires: [], reopen: true },
      ]),
      "POST /v1/portal/tickets/CS0001001/transitions": () => json({ ...resolved, state: "closed", version: 6 }, 201),
    });
    renderPortal(<RequestDetail requestKey="CS0001001" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm closure" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm closure" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Confirm the request is resolved?");
    fireEvent.click(screen.getByRole("button", { name: "Yes, confirm closure" }));
    await waitFor(() =>
      expect(calls.find((call) => call.key === "POST /v1/portal/tickets/CS0001001/transitions")?.body).toEqual({
        version: 5,
        to: "closed",
      }),
    );
    await waitFor(() => expect(screen.getByRole("status", { name: "" })).toBeInTheDocument());
  });

  it("reloads on a stale version instead of retrying", async () => {
    const calls = stubFetch({
      ...routes(),
      "POST /v1/portal/tickets/CS0001001/transitions": () => json({ code: "stale_version", version: 4 }, 409),
    });
    renderPortal(<RequestDetail requestKey="CS0001001" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel request" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel request" }));
    await waitFor(() => expect(screen.getByText("Reloaded")).toBeInTheDocument());
    await waitFor(() =>
      expect(calls.filter((call) => call.key === "GET /v1/portal/tickets/CS0001001").length).toBeGreaterThan(1),
    );
  });

  it("sends a reply and closes the composer on a closed request", async () => {
    const calls = stubFetch({
      ...routes(),
      "POST /v1/portal/tickets/CS0001001/comments": () =>
        json(
          {
            id: "c-3",
            body: "It works now",
            author_name: "Pat Client",
            source: "portal",
            created_at: "2026-09-07T10:00:00Z",
          },
          201,
        ),
    });
    renderPortal(<RequestDetail requestKey="CS0001001" />);
    await waitFor(() => expect(screen.getByLabelText("Reply")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Reply"), { target: { value: "It works now" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() =>
      expect(calls.some((call) => call.key === "POST /v1/portal/tickets/CS0001001/comments")).toBe(true),
    );
    expect(calls.find((call) => call.key === "POST /v1/portal/tickets/CS0001001/comments")?.body).toEqual({
      body: "It works now",
    });

    vi.unstubAllGlobals();
    stubFetch(routes(aPortalTicket({ state: "closed", state_label: "Closed" }), []));
    renderPortal(<RequestDetail requestKey="CS0001001" />);
    await waitFor(() => expect(screen.getByText(/This request is closed/)).toBeInTheDocument());
  });
});
