import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CapacityVariancePage, { sortByVariance, varianceTone } from "@/app/(internal)/capacity/variance/page";
import { varianceFilterToSearch } from "@/lib/capacity/filters";
import {
  ACCOUNT_ID,
  aVarianceLine,
  aVarianceReport,
  OTHER_ACCOUNT_ID,
  OTHER_PERSON_ID,
} from "@/redux/capacityApi.test";
import { aPerson, PERSON_ID } from "@/redux/rosterApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const navigation = vi.hoisted(() => ({ search: "", replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/capacity/variance",
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID, OTHER_ACCOUNT_ID], permissions } });

const ACCOUNTS = [
  { id: ACCOUNT_ID, key: "BRK", name: "Brookfield", status: "active" },
  { id: OTHER_ACCOUNT_ID, key: "AUS", name: "Austral Mining", status: "active" },
];

describe("variance helpers", () => {
  it("orders the largest variances first and tones them by size", () => {
    const small = aVarianceLine({
      person_id: "p-small",
      display_name: "Cara",
      variance_minutes: 30,
      variance_ratio: 0.05,
    });
    const large = aVarianceLine({
      person_id: "p-large",
      display_name: "Dev",
      variance_minutes: -1500,
      variance_ratio: -0.4,
    });
    expect(sortByVariance([small, aVarianceLine(), large]).map((line) => line.display_name)).toEqual([
      "Dev",
      "Ana Silva",
      "Cara",
    ]);
    expect(varianceTone(small)).toBe("calm");
    expect(varianceTone(aVarianceLine({ variance_ratio: 0.2 }))).toBe("warn");
    expect(varianceTone(large)).toBe("breach");
    expect(varianceTone(aVarianceLine({ variance_minutes: 90, variance_ratio: null }))).toBe("breach");
    expect(varianceTone(aVarianceLine({ variance_minutes: 0, variance_ratio: 0 }))).toBe("calm");
  });
});

describe("CapacityVariancePage", () => {
  beforeEach(() => {
    navigation.search = "";
    navigation.replace.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without capacity:view", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["tickets:view"]) });
    renderDesk(<CapacityVariancePage />);
    await screen.findByText("Not permitted");
    expect(calls.some((call) => call.key === "GET /v1/capacity/variance")).toBe(false);
  });

  it("sends the URL filters, formats the variance in hours and percent, totals, and keeps Export disabled", async () => {
    navigation.search = `month=2026-09&account=${ACCOUNT_ID}&person=${PERSON_ID}`;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "tickets:view"]),
      "GET /v1/capacity/variance": () => json(aVarianceReport()),
      "GET /v1/accounts": () => json(ACCOUNTS),
      "GET /v1/roster/people": () => json([aPerson()]),
    });
    renderDesk(<CapacityVariancePage />);
    const table = await screen.findByRole("table", { name: "Planned versus actual" });
    expect(decodeURIComponent(calls.find((call) => call.key === "GET /v1/capacity/variance")?.search ?? "")).toBe(
      `?month=2026-09&account=${ACCOUNT_ID}&person=${PERSON_ID}`,
    );
    const ana = within(table).getByRole("row", { name: /Ana Silva/ });
    expect(ana).toHaveTextContent("BRK");
    expect(ana.querySelector("[data-planned]")).toHaveTextContent("40 h");
    expect(ana.querySelector("[data-actual]")).toHaveTextContent("62 h");
    expect(ana.querySelector("[data-variance]")).toHaveTextContent("+22 h");
    expect(ana.querySelector("[data-percent]")).toHaveTextContent("+55%");
    expect(ana).toHaveAttribute("data-tone", "breach");
    const ben = within(table).getByRole("row", { name: /Ben Ito/ });
    expect(ben.querySelector("[data-variance]")).toHaveTextContent("+1.5 h");
    expect(ben.querySelector("[data-percent]")).toHaveTextContent("n/a");
    // Largest variance first.
    const rows = within(table)
      .getAllByRole("row")
      .filter((row) => row.hasAttribute("data-line"));
    expect(rows[0]).toHaveAttribute("data-line", `${PERSON_ID}:${ACCOUNT_ID}`);
    const totals = screen.getByTestId("variance-totals");
    expect(totals.querySelector("[data-total-planned]")).toHaveTextContent("40 h");
    expect(totals.querySelector("[data-total-actual]")).toHaveTextContent("63.5 h");
    expect(totals.querySelector("[data-total-variance]")).toHaveTextContent("+23.5 h");

    const exportButton = screen.getByRole("button", { name: "Export" });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute("title", "Export waits for an export route.");
    expect(screen.getByRole("link", { name: "Capacity" })).toHaveAttribute(
      "href",
      `/capacity${varianceFilterToSearch({ month: "2026-09" })}`,
    );
  });

  it("rewrites the URL from the person and account pickers", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "tickets:view"]),
      "GET /v1/capacity/variance": () => json(aVarianceReport({ lines: [] })),
      "GET /v1/accounts": () => json(ACCOUNTS),
      "GET /v1/roster/people": () => json([aPerson(), aPerson({ id: OTHER_PERSON_ID, display_name: "Ben Ito" })]),
    });
    renderDesk(<CapacityVariancePage />);
    await screen.findByText("Nothing planned or logged for this month.");
    await screen.findByRole("option", { name: "Ben Ito" });
    fireEvent.change(screen.getByLabelText("Filter by person"), { target: { value: OTHER_PERSON_ID } });
    expect(navigation.replace).toHaveBeenLastCalledWith(`/capacity/variance?person=${OTHER_PERSON_ID}`);
    await screen.findByRole("option", { name: "AUS Austral Mining" });
    fireEvent.change(screen.getByLabelText("Filter by account"), { target: { value: OTHER_ACCOUNT_ID } });
    expect(navigation.replace).toHaveBeenLastCalledWith(`/capacity/variance?account=${OTHER_ACCOUNT_ID}`);
  });
});
