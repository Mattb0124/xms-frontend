import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Finder } from "@/components/shell/finder";
import { visibleScreens } from "@/lib/routes";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const SCREENS = visibleScreens(new Set(["tickets:view", "knowledge:view", "reports:view-portfolio"]));

function finder(overrides: Partial<React.ComponentProps<typeof Finder>> = {}) {
  return renderDesk(
    <Finder
      screens={SCREENS}
      recents={[]}
      pinned={new Set()}
      onTogglePin={() => {}}
      canSeeTickets
      canSeeKnowledge
      {...overrides}
    />,
  );
}

afterEach(() => {
  push.mockClear();
  vi.unstubAllGlobals();
});

describe("Finder", () => {
  it("offers the record directly when what was typed is a key", async () => {
    finder();
    const box = screen.getByLabelText("Search");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "cs1000008" } });

    const row = await screen.findByText("CS1000008");
    expect(row).toBeInTheDocument();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/cases/CS1000008");
  });

  it("searches tickets and solutions, and names each by its key", async () => {
    stubFetch({
      "GET /v1/tickets": () =>
        json({
          items: [
            {
              key: "CS1000008",
              short_description: "Slow report rendering",
              state_label: "Resolved",
            },
          ],
          stats: {},
        }),
      "GET /v1/search/solutions": () => json([{ display_key: "KB100001", title: "VPN client reset loop" }]),
    });
    finder();
    const box = screen.getByLabelText("Search");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "report" } });

    expect(await screen.findByText("Slow report rendering")).toBeInTheDocument();
    expect(await screen.findByText("VPN client reset loop")).toBeInTheDocument();
    expect(screen.getByText("CS1000008")).toBeInTheDocument();
    expect(screen.getByText("KB100001")).toBeInTheDocument();
  });

  // The whole point of the rebuild: the old History listed screens, so ten
  // tickets read "Ticket" ten times. Recents are records and carry their own
  // names (AIBL-329).
  it("rests on the records lately opened, named by key and description", () => {
    finder({
      recents: [
        {
          path: "/cases/CS1000008",
          code: "CS1000008",
          label: "Slow report rendering",
          at: new Date().toISOString(),
        },
      ],
    });
    fireEvent.focus(screen.getByLabelText("Search"));
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("CS1000008")).toBeInTheDocument();
    expect(screen.getByText("Slow report rendering")).toBeInTheDocument();
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("finds screens by name and opens the one chosen", () => {
    finder();
    const box = screen.getByLabelText("Search");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "operations" } });
    fireEvent.click(screen.getByText("Operations"));
    expect(push).toHaveBeenCalledWith("/operations");
  });

  // The pin was the All overlay's, and the overlay is gone; without it the
  // sidebar's extra rows could never be added again.
  it("still pins a screen to the sidebar", () => {
    const onTogglePin = vi.fn();
    finder({ onTogglePin });
    fireEvent.focus(screen.getByLabelText("Search"));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "operations" } });
    fireEvent.click(screen.getByRole("button", { name: "Pin Operations" }));
    expect(onTogglePin).toHaveBeenCalledWith("/operations");
  });

  it("asks neither route for a reader who may not call it", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return json([]);
      }),
    );
    finder({ canSeeTickets: false, canSeeKnowledge: false });
    fireEvent.focus(screen.getByLabelText("Search"));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "operations" } });
    await waitFor(() => expect(screen.getByText("Screens")).toBeInTheDocument());
    expect(calls.some((url) => url.includes("/v1/tickets"))).toBe(false);
    expect(calls.some((url) => url.includes("/v1/search/solutions"))).toBe(false);
  });

  // One character matches most of the table, so the API is not asked for it.
  it("does not search on a single character", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return json([]);
      }),
    );
    finder();
    fireEvent.focus(screen.getByLabelText("Search"));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "r" } });
    await waitFor(() => expect(screen.getByLabelText("Search")).toHaveValue("r"));
    expect(calls.some((url) => url.includes("/v1/tickets?"))).toBe(false);
  });
});
