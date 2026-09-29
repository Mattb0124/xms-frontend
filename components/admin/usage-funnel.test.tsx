import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UsageDashboard } from "@/components/admin/usage-dashboard";
import { AdoptionPanel, FunnelPanel } from "@/components/admin/usage-funnel";
import { dropOffLine, firstUsedLabel, roleLabel, stepLabel, stepWidth } from "@/lib/reporting/usage";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aFunnel, anAdoption, aUsageDashboard } from "@/test-kit/reporting";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/usage",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const me = () => ({
  principal: { kind: "internal", userId: "user-ada", accountIds: [], permissions: ["analytics:read"] },
});

const strip = () => screen.getByTestId("funnel-strip");
const perAccount = () => screen.getByRole("region", { name: "Core loop by account" });
const adoption = () => screen.getByRole("region", { name: "Adoption by role" });

describe("the funnel vocabulary", () => {
  it("names each step of the loop", () => {
    expect(aFunnel().steps.map((step) => stepLabel(step.step))).toEqual([
      "Opened",
      "First reply",
      "Time logged",
      "Solution linked",
      "Resolved",
      "Closed",
    ]);
  });

  it("words a negative drop-off with its reason rather than hiding it", () => {
    const steps = aFunnel().steps;
    expect(dropOffLine(steps[0], 0)).toBeNull();
    expect(dropOffLine(steps[1], 1)).toBe("9 fewer than the step before");
    expect(dropOffLine(steps[3], 3)).toBe(
      "2 more than the step before, since a ticket can reach this step without the one before it",
    );
    expect(dropOffLine(steps[4], 4)).toBe("None lost from the step before");
  });

  it("sizes each bar against the largest step, and survives an all-zero loop", () => {
    const steps = aFunnel().steps;
    expect(stepWidth(steps[0], steps)).toBe(100);
    expect(stepWidth(steps[2], steps)).toBe(45);
    const empty = steps.map((step) => ({ ...step, n: 0 }));
    expect(stepWidth(empty[0], empty)).toBe(0);
  });

  it("names the role the API reports for an actor holding none", () => {
    const rows = anAdoption();
    expect(roleLabel(rows[0])).toBe("Consultant");
    expect(roleLabel(rows[2])).toBe("No role assigned");
    expect(firstUsedLabel(rows[0].first_used_at)).toBe("2026-03-02");
  });
});

describe("FunnelPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("draws the six steps with their counts and the drop-off in words", () => {
    stubFetch({ "GET /v1/admin/me": () => json(me()) });
    renderDesk(<FunnelPanel funnel={aFunnel()} />);

    const steps = within(strip()).getAllByRole("listitem");
    expect(steps).toHaveLength(6);
    expect(steps[0]).toHaveTextContent("Opened");
    expect(steps[0]).toHaveTextContent("40");
    expect(steps[0]).toHaveTextContent("The start of the loop");
    expect(steps[1]).toHaveTextContent("9 fewer than the step before");
    // The step that gained is said, not swallowed.
    expect(steps[3]).toHaveTextContent("2 more than the step before");
    expect(steps[3].querySelector("[data-drop-off]")).toHaveAttribute("data-drop-off", "-2");
  });

  it("lists the accounts busiest first and opens each account's dashboard", () => {
    stubFetch({ "GET /v1/admin/me": () => json(me()) });
    renderDesk(<FunnelPanel funnel={aFunnel()} />);

    const names = within(perAccount())
      .getAllByRole("link")
      .map((link) => link.textContent);
    // The fixture sends Northwind first; the table opens on tickets opened.
    expect(names).toEqual(["Brookfield", "Northwind Health"]);
    expect(within(perAccount()).getByRole("link", { name: "Brookfield" })).toHaveAttribute("href", "/accounts/acct-1");

    const busiest = within(perAccount())
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("Brookfield"))!;
    expect(busiest).toHaveTextContent("31");
    expect(busiest).toHaveTextContent("26");
    expect(busiest).toHaveTextContent("10");
  });

  it("leaves the per-account table out when no account is in the window", () => {
    stubFetch({ "GET /v1/admin/me": () => json(me()) });
    renderDesk(<FunnelPanel funnel={aFunnel({ per_account: [] })} />);
    expect(screen.queryByRole("region", { name: "Core loop by account" })).not.toBeInTheDocument();
    expect(strip()).toBeInTheDocument();
  });
});

describe("AdoptionPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports each role's actions, the people, the times and the first use", () => {
    stubFetch({ "GET /v1/admin/me": () => json(me()) });
    renderDesk(<AdoptionPanel rows={anAdoption()} />);

    const consultant = within(adoption())
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("ticket.create"))!;
    expect(consultant).toHaveTextContent("Consultant");
    expect(consultant).toHaveTextContent("6");
    expect(consultant).toHaveTextContent("84");
    // The first-use date reaches past the window on purpose.
    expect(consultant).toHaveTextContent("2026-03-02");
    expect(within(adoption()).getByText("No role assigned")).toBeInTheDocument();
  });
});

describe("the Usage dashboard with both measures", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("draws the loop and the adoption table beside the strip", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/dashboards/usage": () => json(aUsageDashboard()),
    });
    renderDesk(<UsageDashboard />);

    await waitFor(() => expect(screen.getByTestId("funnel-strip")).toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Adoption by role" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Accounts" })).toBeInTheDocument();
  });

  it("leaves both out where an older API does not answer them", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/dashboards/usage": () => json({ active_users: [{ key: "internal", n: 3 }], per_account: [] }),
    });
    renderDesk(<UsageDashboard />);

    await waitFor(() => expect(screen.getByText("Top actions")).toBeInTheDocument());
    expect(screen.queryByTestId("funnel-strip")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Adoption by role" })).not.toBeInTheDocument();
  });
});
