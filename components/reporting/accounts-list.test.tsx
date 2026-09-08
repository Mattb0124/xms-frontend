import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountsList, filterAccounts } from "@/components/reporting/accounts-list";
import { json, renderDeskInShell, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({
  usePathname: () => "/accounts",
  useRouter: () => ({ push: vi.fn() }),
}));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["a-1", "a-2"], permissions } });

const accounts = () =>
  json([
    { id: "a-1", key: "BRK", name: "Brookfield", status: "active" },
    { id: "a-2", key: "AUS", name: "Austral Mining", status: "offboarding" },
  ]);

describe("the accounts list's dimensions", () => {
  it("narrows on the status and on the words typed, against the name and the key", () => {
    const rows = [
      { name: "Brookfield", key: "BRK", status: "active" },
      { name: "Austral Mining", key: "AUS", status: "offboarding" },
    ];
    expect(filterAccounts(rows, "", "").map((row) => row.key)).toEqual(["BRK", "AUS"]);
    expect(filterAccounts(rows, "active", "").map((row) => row.key)).toEqual(["BRK"]);
    expect(filterAccounts(rows, "", "aus").map((row) => row.key)).toEqual(["AUS"]);
    expect(filterAccounts(rows, "", "mining").map((row) => row.key)).toEqual(["AUS"]);
    expect(filterAccounts(rows, "active", "aus")).toEqual([]);
  });
});

describe("AccountsList", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stands its Show dimension on the strip, counts the rows behind it, and searches in the card", async () => {
    stubFetch({ "GET /v1/admin/me": me(["tickets:view"]), "GET /v1/accounts": accounts });
    renderDeskInShell(<AccountsList />);
    await screen.findByText("Brookfield");
    const show = screen.getByLabelText("Show");
    expect(within(screen.getByTestId("filter-show")).getByText("all (2)")).toBeTruthy();

    fireEvent.change(show, { target: { value: "active" } });
    expect(screen.queryByText("Austral Mining")).toBeNull();
    expect(screen.getByText("Brookfield")).toBeTruthy();

    fireEvent.change(show, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Search accounts by name or key"), { target: { value: "aus" } });
    expect(screen.queryByText("Brookfield")).toBeNull();
    expect(screen.getByText("Austral Mining")).toBeTruthy();
  });

  it("keeps the portfolio columns behind the portfolio permission", async () => {
    stubFetch({ "GET /v1/admin/me": me(["tickets:view"]), "GET /v1/accounts": accounts });
    renderDeskInShell(<AccountsList />);
    await screen.findByText("Brookfield");
    expect(screen.queryByText("Breached")).toBeNull();
  });
});
