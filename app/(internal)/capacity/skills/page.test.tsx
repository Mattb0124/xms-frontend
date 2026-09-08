import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CapacitySkillsPage from "@/app/(internal)/capacity/skills/page";
import { heatMapRows } from "@/components/capacity/skills-heat-map";
import { ACCOUNT_ID, aSkillsMatrixAccount, aSkillsMatrixPeople, OTHER_ACCOUNT_ID, OTHER_PERSON_ID } from "@/redux/capacityApi.test";
import { PERSON_ID } from "@/redux/rosterApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const navigation = vi.hoisted(() => ({ search: "", replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/capacity/skills",
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID, OTHER_ACCOUNT_ID], permissions } });

const MATRIX = "GET /v1/capacity/skills-matrix";

const SKILLS = [
  { id: "s-close", kind: "process", code: "close", name: "Financial close", account_id: null, is_active: true },
  { id: "s-anaplan", kind: "technology", code: "anaplan", name: "Anaplan", account_id: null, is_active: true },
  { id: "s-onestream", kind: "technology", code: "onestream", name: "OneStream", account_id: null, is_active: true },
];

describe("heat map rows", () => {
  it("keeps the role's people only, by name", () => {
    const people = aSkillsMatrixPeople().people;
    expect(heatMapRows(people).map((person) => person.id)).toEqual([PERSON_ID, OTHER_PERSON_ID]);
    expect(heatMapRows(people, "consultant").map((person) => person.display_name)).toEqual(["Ben Ito"]);
    expect(heatMapRows(people, "architect")).toEqual([]);
  });
});

describe("CapacitySkillsPage", () => {
  beforeEach(() => {
    navigation.search = "";
    navigation.replace.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without capacity:view and never asks for the matrix", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["tickets:view", "capacity:manage"]) });
    renderDesk(<CapacitySkillsPage />);
    await screen.findByText("Not permitted");
    expect(screen.getByText(/needs the capacity:view permission/)).toBeInTheDocument();
    expect(calls.some((call) => call.key === MATRIX)).toBe(false);
  });

  it("opens on the people lens as a heat map: columns grouped by kind, cells on the level ramp, blank without a level", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view"]),
      [MATRIX]: () => json(aSkillsMatrixPeople()),
    });
    renderDesk(<CapacitySkillsPage />);
    const table = await screen.findByRole("table", { name: "Skills heat map" });
    expect(decodeURIComponent(calls.find((call) => call.key === MATRIX)?.search ?? "")).toBe("?lens=people");
    // Technology before process; names ascending inside a kind.
    const groups = table.querySelectorAll("th[data-kind]");
    expect([...groups].map((cell) => [cell.textContent, cell.getAttribute("colspan")])).toEqual([
      ["Technology", "2"],
      ["Process", "1"],
    ]);
    expect([...table.querySelectorAll("th[data-skill]")].map((cell) => cell.textContent)).toEqual([
      "Anaplan",
      "OneStream",
      "Financial close",
    ]);
    const ana = within(table).getByRole("row", { name: /Ana Silva/ });
    const anaOnestream = ana.querySelector('[data-skill="onestream"]');
    expect(anaOnestream).toHaveTextContent("4");
    expect(anaOnestream).toHaveAttribute("data-level", "4");
    expect(anaOnestream).toHaveClass("bg-xms-accent");
    expect(ana.querySelector('[data-skill="close"]')).toHaveAttribute("data-level", "2");
    const ben = within(table).getByRole("row", { name: /Ben Ito/ });
    const benClose = ben.querySelector('[data-skill="close"]');
    expect(benClose).toHaveTextContent("");
    expect(benClose).not.toHaveAttribute("data-level");
    expect(benClose).not.toHaveClass("bg-xms-tint");
    expect(ben.querySelector('[data-skill="onestream"]')).toHaveClass("bg-xms-accent-tint-strong");
    expect(within(table).getByRole("link", { name: "Ana Silva" })).toHaveAttribute("href", `/roster/${PERSON_ID}`);
    expect(screen.getByRole("link", { name: "Skills matrix" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "People" })).toHaveAttribute("aria-pressed", "true");
  });

  it("narrows the heat map to the role in the URL", async () => {
    navigation.search = "role=consultant";
    stubFetch({
      "GET /v1/admin/me": me(["capacity:view"]),
      [MATRIX]: () => json(aSkillsMatrixPeople()),
    });
    renderDesk(<CapacitySkillsPage />);
    const table = await screen.findByRole("table", { name: "Skills heat map" });
    expect(within(table).queryByRole("row", { name: /Ana Silva/ })).not.toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Ben Ito/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by role")).toHaveValue("consultant");
    fireEvent.change(screen.getByLabelText("Filter by role"), { target: { value: "architect" } });
    expect(navigation.replace).toHaveBeenLastCalledWith("/capacity/skills?role=architect");
  });

  /**
   * Review finding 15: with an empty catalog the heat map drew a table with a
   * single "Person" column and one blank row per person, then an empty-state
   * line underneath. A grid with zero columns is worse than no grid.
   */
  it("shows the empty state instead of a headerless grid when the catalog holds no skills", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["capacity:view"]),
      [MATRIX]: () => json(aSkillsMatrixPeople({ skills: [] })),
    });
    renderDesk(<CapacitySkillsPage />);
    expect(await screen.findByText("No skills in the catalog yet")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Skills heat map" })).toBeNull();
    expect(screen.queryByText("Ana Silva")).toBeNull();
    expect(screen.getByText(/Add them from a person record/)).toBeInTheDocument();
  });

  it("shows the account lens as a card per account with the status pills and the qualified names, sending the account filter", async () => {
    navigation.search = `lens=account&account=${ACCOUNT_ID}`;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view"]),
      [MATRIX]: () => json(aSkillsMatrixAccount()),
      "GET /v1/roster/skills": () => json(SKILLS),
    });
    renderDesk(<CapacitySkillsPage />);
    const list = await screen.findByRole("list", { name: "Technologies for BRK" });
    // The names come from the skills catalog, read alongside the lens.
    await within(list).findByText("OneStream");
    expect(decodeURIComponent(calls.find((call) => call.key === MATRIX)?.search ?? "")).toBe(
      `?lens=account&account=${ACCOUNT_ID}`,
    );

    // No account directory without tickets:view; the lens's own accounts fill the picker.
    expect(calls.some((call) => call.key === "GET /v1/accounts")).toBe(false);
    expect(screen.getByRole("region", { name: "BRK Brookfield" })).toHaveTextContent(
      "3 technologies required by the active contracts, 1 single point of failure, 1 gap.",
    );
    const anaplan = list.querySelector('[data-technology="anaplan"]') as HTMLElement;
    expect(within(anaplan).getByText("Covered")).toHaveAttribute("data-state", "complete");
    expect(anaplan.querySelector("[data-qualified]")).toHaveTextContent("Ana Silva, Ben Ito");
    const onestream = list.querySelector('[data-technology="onestream"]') as HTMLElement;
    expect(onestream).toHaveTextContent("OneStream");
    expect(within(onestream).getByText("Single point of failure")).toHaveAttribute("data-state", "needs-input");
    expect(onestream.querySelector("[data-qualified]")).toHaveTextContent("Ana Silva");
    expect(within(onestream).getByRole("link", { name: "Ana Silva" })).toHaveAttribute("href", `/roster/${PERSON_ID}`);
    const sap = list.querySelector('[data-technology="sap"]') as HTMLElement;
    // Not in the catalog: the code stands in for the name.
    expect(sap).toHaveTextContent("sap");
    expect(within(sap).getByText("Gap")).toHaveAttribute("data-state", "overdue");
    expect(sap.querySelector("[data-qualified]")).toHaveTextContent("Nobody at level 3");
    expect(screen.getByLabelText("Filter by account")).toHaveValue(ACCOUNT_ID);
    expect(screen.getByRole("button", { name: "Accounts" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Filter by role")).not.toBeInTheDocument();
  });

  it("switches the lens and the account through the URL", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "tickets:view"]),
      [MATRIX]: () => json(aSkillsMatrixPeople()),
    });
    renderDesk(<CapacitySkillsPage />);
    await screen.findByRole("table", { name: "Skills heat map" });
    fireEvent.click(screen.getByRole("button", { name: "Accounts" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/capacity/skills?lens=account");
  });

  it("offers the granted accounts as the account filter under tickets:view and words a refused account", async () => {
    navigation.search = "lens=account";
    stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "tickets:view"]),
      [MATRIX]: () => json(aSkillsMatrixAccount()),
      "GET /v1/accounts": () =>
        json([
          { id: ACCOUNT_ID, key: "BRK", name: "Brookfield", status: "active" },
          { id: OTHER_ACCOUNT_ID, key: "AUS", name: "Austral Mining", status: "active" },
        ]),
      "GET /v1/roster/skills": () => json(SKILLS),
    });
    renderDesk(<CapacitySkillsPage />);
    await screen.findByRole("list", { name: "Technologies for BRK" });
    await screen.findByRole("option", { name: "AUS Austral Mining" });
    fireEvent.change(screen.getByLabelText("Filter by account"), { target: { value: OTHER_ACCOUNT_ID } });
    expect(navigation.replace).toHaveBeenLastCalledWith(`/capacity/skills?lens=account&account=${OTHER_ACCOUNT_ID}`);
  });

  it("words a not_found account from the lens with a retry", async () => {
    navigation.search = "lens=account&account=99999999-9999-4999-8999-999999999999";
    stubFetch({
      "GET /v1/admin/me": me(["capacity:view"]),
      [MATRIX]: () => json({ code: "not_found", entity: "account" }, 404),
    });
    renderDesk(<CapacitySkillsPage />);
    await screen.findByText("The skills matrix could not be loaded");
    expect(screen.getByText("That account is not granted to you.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
