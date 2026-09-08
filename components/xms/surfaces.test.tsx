import { readFileSync, readdirSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BriefLine } from "@/components/xms/brief-line";
import { CloseDisciplineChecklist } from "@/components/xms/close-discipline-checklist";
import { DispatchCard } from "@/components/xms/dispatch-card";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { MeterBar } from "@/components/xms/meter-bar";
import { NudgeCard } from "@/components/xms/nudge-card";
import { Panel } from "@/components/xms/panel";
import { RailCard } from "@/components/xms/rail-card";
import { ScoreTile } from "@/components/xms/score-tile";
import { Skeleton } from "@/components/xms/skeleton";
import { SuggestionCard } from "@/components/xms/suggestion-card";
import { TabBar } from "@/components/xms/tab-bar";
import { ToolCallRow } from "@/components/xms/tool-call-row";

describe("Panel and RailCard", () => {
  it("render title, caption, actions and a flush body", () => {
    render(
      <Panel title="Needs attention" caption="Today" actions={<button>Refresh</button>} flush>
        <table />
      </Panel>,
    );
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByText("Today")).toHaveClass("xms-caption");
    expect(screen.getByText("Refresh")).toBeInTheDocument();
    render(
      <RailCard caption="Service levels" action={<a href="#">Edit</a>}>
        body
      </RailCard>,
    );
    expect(screen.getByLabelText("Service levels")).toHaveClass("xms-card");
  });
});

describe("TabBar", () => {
  it("marks the active tab and reports changes", () => {
    const onChange = vi.fn();
    render(
      <TabBar
        tabs={[
          { key: "conversation", label: "Conversation", count: 5 },
          { key: "activity", label: "Activity" },
        ]}
        active="conversation"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("tab", { name: /Conversation/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Activity" }));
    expect(onChange).toHaveBeenCalledWith("activity");
  });
});

describe("ScoreTile and MeterBar", () => {
  it("renders a linked mono value with tone", () => {
    render(<ScoreTile label="Breached" value={3} tone="breach" href="/tickets?view=breached" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/tickets?view=breached");
    expect(screen.getByText("3")).toHaveAttribute("data-tone", "breach");
  });

  it("clamps the fill and paints pause segments", () => {
    const { container } = render(
      <MeterBar percent={140} breached pauses={[{ startPct: 20, endPct: 35 }]} label="Resolution" />,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("data-breached", "true");
    const pause = container.querySelector("[data-pause]") as HTMLElement;
    expect(pause.style.left).toBe("20%");
    expect(pause.style.width).toBe("15%");
  });
});

describe("BriefLine and NudgeCard", () => {
  it("dismisses the brief and fires the nudge action", () => {
    const onDismiss = vi.fn();
    const onAction = vi.fn();
    render(
      <>
        <BriefLine text="Two P1s are within an hour of breach." onDismiss={onDismiss} />
        <NudgeCard title="Log time" detail="45m unlogged" actionLabel="Log now" onAction={onAction} origin="ai" />
      </>,
    );
    fireEvent.click(screen.getByLabelText("Dismiss brief"));
    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByText(/Two P1s/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Log now"));
    expect(onAction).toHaveBeenCalled();
    expect(screen.getByText("Log time").closest("[data-origin]")).toHaveAttribute("data-origin", "ai");
  });
});

describe("DispatchCard", () => {
  it("confirms the chosen group and assignee and supports Assign to me", () => {
    const onConfirm = vi.fn();
    render(
      <DispatchCard
        ticketKey="CS0001204"
        shortDescription="HFM consolidation fails"
        account={{ name: "Brookfield UK", hue: 1 }}
        type="incident"
        priority="p1"
        sla={{ dueAt: "2026-09-07T12:00:00Z" }}
        groups={[{ id: "g1", label: "OneStream Technical" }]}
        assignees={[
          { id: "u1", label: "Maria" },
          { id: "u2", label: "Me", warning: "Over capacity" },
        ]}
        suggestion="Axel: OneStream Technical · 82%"
        currentUserId="u2"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByText("Assign to me"));
    expect(screen.getByText("Over capacity")).toHaveAttribute("data-state", "needs-input");
    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledWith({ groupId: "g1", assigneeId: "u2" });
    expect(screen.getByText(/Axel: OneStream/)).toHaveClass("xms-ai");
  });
});

describe("CloseDisciplineChecklist", () => {
  it("counts the missing items", () => {
    render(
      <CloseDisciplineChecklist
        items={[
          { key: "time", label: "Time logged", done: true },
          { key: "resolution_code", label: "Resolution code", done: false },
          { key: "solution", label: "Solution linked", done: false },
        ]}
      />,
    );
    expect(screen.getByText("2 items missing before Resolved.")).toBeInTheDocument();
    expect(screen.getByText("Time logged").closest("li")).toHaveAttribute("data-done", "true");
  });
});

describe("SuggestionCard and ToolCallRow", () => {
  it("renders on the violet family with accept and reject", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(
      <>
        <SuggestionCard
          capability="categorise"
          title="Category: HFM"
          body="Matches 12 resolved tickets"
          confidence={0.82}
          onAccept={onAccept}
          onReject={onReject}
        />
        <ToolCallRow tool="search_solutions" args={'ci="HFM PROD"'} result="3 results" />
      </>,
    );
    expect(screen.getByRole("article")).toHaveClass("xms-ai");
    expect(screen.getByText("82%")).toHaveClass("xms-mono");
    fireEvent.click(screen.getByText("Accept"));
    fireEvent.click(screen.getByText("Reject"));
    expect(onAccept).toHaveBeenCalled();
    expect(onReject).toHaveBeenCalled();
    expect(screen.getByText('search_solutions(ci="HFM PROD")')).toBeInTheDocument();
    expect(screen.getByText("3 results")).toBeInTheDocument();
  });
});

describe("Skeleton and EmptyBanner", () => {
  it("render placeholders and the ink banner with a link", () => {
    const { container } = render(
      <>
        <Skeleton lines={3} />
        <EmptyBanner
          title="Set up a contract to start taking tickets"
          action={{ label: "Contracts", href: "/accounts" }}
        />
      </>,
    );
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveClass("bg-xms-navy");
    expect(screen.getByRole("link", { name: "Contracts" })).toHaveAttribute("href", "/accounts");
  });
});

/**
 * One focus treatment, and only one (reviewer finding 11). The vendored
 * aiinnovation-tokens.css draws a global :focus-visible outline; components
 * were drawing a Tailwind ring over it, so a clicked control showed a dark box
 * and a cobalt ring at once. The single treatment now lives in
 * styles/tokens/xms-scope.css and nothing under components/ may add its own.
 */
describe("the focus treatment", () => {
  // The suite files are left out: this one names the classes it is banning.
  const files = readdirSync("components", { recursive: true, encoding: "utf8" }).filter(
    (file) => file.endsWith(".tsx") && !file.includes(".test."),
  );

  it("is stated once in the scope and never in a component", () => {
    expect(files.length).toBeGreaterThan(40);
    const offenders = files.filter((file) => {
      const source = readFileSync(`components/${file}`, "utf8");
      return /focus-visible:ring|focus-visible:outline|focus:border-|focus-within:border-/.test(
        source.replace(/^.*\/\/.*$/gm, ""),
      );
    });
    expect(offenders).toEqual([]);
  });

  it("cancels the vendored offset ring inside the scope", () => {
    const scope = readFileSync("styles/tokens/xms-scope.css", "utf8");
    expect(scope).toContain(".xms-scope :focus-visible");
    expect(scope).toContain("outline: 2px solid var(--xms-accent)");
    expect(scope).toContain("outline-offset: 0");
  });
});
