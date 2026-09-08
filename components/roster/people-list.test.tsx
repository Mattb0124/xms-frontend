import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PeopleList } from "@/components/roster/people-list";
import { aPerson, aPersonSkill, GROUP_ID } from "@/test-kit/roster";

describe("PeopleList", () => {
  it("renders one row per person with role, FTE, zone, group chips, skill chips with the level and the active pill", () => {
    render(
      <PeopleList
        groupNames={{ [GROUP_ID]: "OneStream squad" }}
        rows={[
          aPerson(),
          aPerson({
            id: "p2",
            display_name: "Ben Ito",
            email: "ben@example.com",
            role: "team_lead",
            fte_percent: "62.50",
            time_zone: "Australia/Sydney",
            assignment_group_ids: [],
            skills: [aPersonSkill({ skill_id: "s2", code: "coupa", name: "Coupa", level: 1 })],
            is_active: false,
          }),
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Ana Silva" })).toHaveAttribute("href", `/roster/${aPerson().id}`);
    expect(screen.getByText("Senior Consultant")).toBeInTheDocument();
    expect(screen.getByText("Team Lead")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("62.5%")).toBeInTheDocument();
    expect(screen.getByText("Australia/Sydney")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Groups of Ana Silva")).getByText("OneStream squad")).toBeInTheDocument();
    const skills = screen.getByLabelText("Skills of Ana Silva");
    expect(within(skills).getByText("OneStream")).toBeInTheDocument();
    expect(within(skills).getByText("3")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Skills of Ben Ito")).getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Active")).toHaveAttribute("data-state", "complete");
    expect(screen.getByText("Inactive")).toHaveAttribute("data-state", "blocked");
    expect(screen.queryByText(/rate/i)).not.toBeInTheDocument();
  });

  it("falls back to a short id when the reader cannot resolve group names", () => {
    render(<PeopleList rows={[aPerson()]} />);
    expect(within(screen.getByLabelText("Groups of Ana Silva")).getByText(GROUP_ID.slice(0, 8))).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    render(<PeopleList rows={[]} emptyState="No one matches." />);
    expect(screen.getByText("No one matches.")).toBeInTheDocument();
  });
});
