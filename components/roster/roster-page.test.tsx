import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RosterPage from "@/app/(internal)/roster/page";
import { aPerson, aSkill, GROUP_ID } from "@/redux/rosterApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const navigation = vi.hoisted(() => ({
  search: "",
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/roster",
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [], permissions } });

describe("RosterPage", () => {
  beforeEach(() => {
    navigation.search = "";
    navigation.replace.mockReset();
    navigation.push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without capacity:view", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["tickets:view"]) });
    renderDesk(<RosterPage />);
    await screen.findByText("Not permitted");
    expect(screen.getByText(/needs the capacity:view permission/)).toBeInTheDocument();
    expect(calls.some((call) => call.key === "GET /v1/roster/people")).toBe(false);
  });

  it("reads the filters from the URL, asks the API with them and only fetches groups with admin:users", async () => {
    navigation.search = "active=all&role=consultant&skill=onestream&q=ana";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view"]),
      "GET /v1/roster/people": () => json([aPerson()]),
      "GET /v1/roster/skills": () => json([aSkill()]),
      "GET /v1/admin/groups": () => json([{ id: GROUP_ID, name: "OneStream squad" }]),
    });
    renderDesk(<RosterPage />);
    await screen.findByRole("link", { name: "Ana Silva" });
    const list = calls.find((call) => call.key === "GET /v1/roster/people");
    expect(list?.search).toBe("?active=all&role=consultant&skill=onestream&q=ana");
    expect(calls.some((call) => call.key === "GET /v1/admin/groups")).toBe(false);
    // Groups cannot be resolved, so the chip shows the short id and the filter is disabled.
    expect(screen.getByText(GROUP_ID.slice(0, 8))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New person" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import from directory" })).not.toBeInTheDocument();
  });

  it("resolves group names with admin:users and rewrites the URL when a filter is chosen", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "admin:users"]),
      "GET /v1/roster/people": () => json([aPerson()]),
      "GET /v1/roster/skills": () => json([aSkill()]),
      "GET /v1/admin/groups": () => json([{ id: GROUP_ID, name: "OneStream squad" }]),
    });
    renderDesk(<RosterPage />);
    await screen.findByRole("link", { name: "Ana Silva" });
    await screen.findByText("OneStream squad");
    // The header slots are not mounted here, so open the chooser through the search form instead.
    fireEvent.change(screen.getByLabelText("Search people"), { target: { value: "ben" } });
    fireEvent.submit(screen.getByLabelText("Search people").closest("form")!);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/roster?q=ben"));
  });
});
