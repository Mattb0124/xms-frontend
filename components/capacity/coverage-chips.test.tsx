import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountCoverageChips } from "@/components/capacity/coverage-chips";
import { ACCOUNT_ID, aSkillsMatrixAccount, OTHER_ACCOUNT_ID } from "@/redux/capacityApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => `/admin/accounts/${ACCOUNT_ID}` }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID, OTHER_ACCOUNT_ID], permissions } });

const MATRIX = "GET /v1/capacity/skills-matrix";
const SKILLS = [
  { id: "s-onestream", kind: "technology", code: "onestream", name: "OneStream", account_id: null, is_active: true },
  { id: "s-sap", kind: "technology", code: "sap", name: "SAP", account_id: null, is_active: true },
];

describe("AccountCoverageChips", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows one chip per single point of failure and per gap, named from the catalog, asking the lens for this account", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view", "capacity:view"]),
      [MATRIX]: () => json(aSkillsMatrixAccount()),
      "GET /v1/roster/skills": () => json(SKILLS),
    });
    renderDesk(<AccountCoverageChips accountId={ACCOUNT_ID} />);
    const list = await screen.findByRole("list", { name: "Skills coverage" });
    await within(list).findByText("Single point of failure: OneStream");
    expect(decodeURIComponent(calls.find((call) => call.key === MATRIX)?.search ?? "")).toBe(
      `?lens=account&account=${ACCOUNT_ID}`,
    );
    expect(within(list).getByText("Single point of failure: OneStream")).toHaveAttribute("data-state", "needs-input");
    expect(within(list).getByText("Gap: SAP")).toHaveAttribute("data-state", "overdue");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByRole("link", { name: "Skills matrix" })).toHaveAttribute(
      "href",
      `/capacity/skills?lens=account&account=${ACCOUNT_ID}`,
    );
  });

  it("renders nothing when the account is fully covered", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["capacity:view"]),
      [MATRIX]: () =>
        json(
          aSkillsMatrixAccount({
            accounts: [
              {
                ...aSkillsMatrixAccount().accounts[0],
                technologies: [aSkillsMatrixAccount().accounts[0].technologies[0]],
                single_points_of_failure: [],
                gaps: [],
              },
            ],
          }),
        ),
    });
    const { container } = renderDesk(<AccountCoverageChips accountId={ACCOUNT_ID} />);
    await screen.findByText("", { selector: "body" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("list", { name: "Skills coverage" })).not.toBeInTheDocument();
    expect(container.querySelector("[data-testid='coverage-chips']")).toBeNull();
  });

  it("never asks the lens without capacity:view", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["tickets:view", "admin:accounts"]) });
    renderDesk(<AccountCoverageChips accountId={ACCOUNT_ID} />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls.some((call) => call.key === "GET /v1/admin/me")).toBe(true);
    expect(calls.some((call) => call.key === MATRIX)).toBe(false);
    expect(screen.queryByRole("list", { name: "Skills coverage" })).not.toBeInTheDocument();
  });
});
