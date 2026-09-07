import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchHome } from "@/components/portal/search-home";
import { aPortalTicket, json, renderPortal, stubFetch } from "@/test-kit/portal";

vi.mock("next/navigation", () => ({ usePathname: () => "/portal", useRouter: () => ({ push: vi.fn() }) }));

describe("portal search home", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the open count, and searches own requests plus the knowledge placeholder once two characters are typed", async () => {
    const calls = stubFetch({
      "GET /v1/portal/tickets": (body) => {
        void body;
        return json({ items: [aPortalTicket()], next_cursor: null });
      },
    });
    renderPortal(<SearchHome debounceMs={0} />);
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
    expect(screen.queryByText("Knowledge articles will appear here.")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search solutions and your requests"), { target: { value: "r" } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(calls.some((call) => call.search.includes("q="))).toBe(false);

    fireEvent.change(screen.getByLabelText("Search solutions and your requests"), { target: { value: "report" } });
    await waitFor(() => expect(screen.getByText("Knowledge articles will appear here.")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Cannot open the consolidation report")).toBeInTheDocument());
    expect(calls.some((call) => call.search === "?scope=all&q=report")).toBe(true);
  });

  it("links to My requests and New request", async () => {
    stubFetch({ "GET /v1/portal/tickets": () => json({ items: [], next_cursor: null }) });
    renderPortal(<SearchHome debounceMs={0} />);
    expect(screen.getByRole("link", { name: "See my requests" })).toHaveAttribute("href", "/portal/requests");
    expect(screen.getByRole("link", { name: "New request" })).toHaveAttribute("href", "/portal/requests/new");
    await waitFor(() => expect(screen.getByText("0")).toBeInTheDocument());
  });
});
