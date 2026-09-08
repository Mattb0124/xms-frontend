import { readFileSync, readdirSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BriefLine } from "@/components/xms/brief-line";
import { CloseDisciplineChecklist } from "@/components/xms/close-discipline-checklist";
import { DispatchRow } from "@/components/xms/dispatch-card";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { ICON } from "@/components/xms/icons";
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
  it("links a mono number in ink, with the sub-line under it and no signal colour", () => {
    render(<ScoreTile label="Breached" value={3} detail="CS0001203" href="/tickets?view=breached" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/tickets?view=breached");
    // Both renders draw every scorecard number in ink. The tile carried a
    // tone, so a Breached count of zero was drawn in the "good" green and an
    // At risk count of zero in amber: a signal where there was none.
    const value = screen.getByText("3");
    expect(value).toHaveClass("xms-mono", "text-xms-ink");
    expect(value).not.toHaveAttribute("data-tone");
    expect(screen.getByText("CS0001203")).toBeInTheDocument();
  });

  it("puts the sub-line beside the number only when the caller asks", () => {
    const { container } = render(<ScoreTile label="Open" value={218} detail="+12 this week" detailBeside />);
    // Render 10's tiles read "218  +12 this week" on one baseline; render 08's
    // read the number over its own line.
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(screen.getByText("+12 this week")).toBeInTheDocument();
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

describe("DispatchRow", () => {
  function renderRow(onConfirm = vi.fn()) {
    render(
      <DispatchRow
        ticketKey="CS0001204"
        shortDescription="HFM consolidation fails"
        account={{ name: "Brookfield UK", hue: 1 }}
        age="26m"
        groups={[{ id: "g1", label: "OneStream Technical" }]}
        assignees={[
          { id: "u1", label: "S. Ali" },
          { id: "u2", label: "Me", warning: "104% of capacity, override reason required" },
        ]}
        suggestion="S. Ali"
        currentUserId="u2"
        onConfirm={onConfirm}
      />,
    );
    return onConfirm;
  }

  it("reads key, title, account and age, and confirms the chosen group and assignee", () => {
    const onConfirm = renderRow();
    // Render 09's first line: the key, the title, the account and the age.
    expect(screen.getByRole("link", { name: "CS0001204" })).toBeInTheDocument();
    expect(screen.getByText("26m")).toHaveClass("xms-mono");
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "g1" } });
    fireEvent.click(screen.getByText("Assign to me"));
    expect(screen.getByText("104% of capacity, override reason required")).toHaveAttribute("data-state", "needs-input");
    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledWith({ groupId: "g1", assigneeId: "u2" });
  });

  it("offers the suggestion as a control that takes it, and applies nothing until Confirm", () => {
    const onConfirm = renderRow();
    const suggestion = screen.getByText("Axel suggests S. Ali");
    fireEvent.click(suggestion);
    // Taking the suggestion fills the picker; it does not route the ticket.
    expect(screen.getByLabelText("Assignee")).toHaveValue("u1");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("opens on Choose group and Choose assignee where the ticket has neither", () => {
    renderRow();
    expect(screen.getAllByText("Choose group").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Choose assignee").length).toBeGreaterThan(0);
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
  it("render placeholders, and the empty state as a card rather than an ink slab", () => {
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
    // No v3 render draws a black block in the content area; render 11 draws
    // this state as the prototype's own white card.
    const banner = screen.getByRole("status");
    expect(banner).toHaveClass("xms-card");
    expect(banner.className).not.toContain("bg-xms-navy");
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

/** Every `.tsx` under components/ and app/ that is not a suite file. */
function sourceFiles(): string[] {
  const out: string[] = [];
  for (const root of ["components", "app"]) {
    for (const file of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      // readdirSync hands back the platform separator; the assertions read
      // better with one.
      const path = `${root}/${file}`.replace(/\\/g, "/");
      if (path.endsWith(".tsx") && !path.includes(".test.")) out.push(path);
    }
  }
  return out;
}

/**
 * One icon scale, named by the job (hand-off section 6: Lucide, 1.5px stroke,
 * currentColor, never filled, 14 to 19px on a 24px canvas). The shell was
 * mixing 13, 14, 15, 16, 17, 18 and 19 by eye.
 */
describe("the icon scale", () => {
  it("is the only way to size an icon", () => {
    const files = sourceFiles().filter((file) => !file.endsWith("components/xms/icons.tsx"));
    expect(files.length).toBeGreaterThan(80);
    const offenders = files.filter((file) => /size=\{\d/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("runs 13 to 19 on the one canvas, with the glyph size below the hand-off floor named as such", () => {
    expect(Object.values(ICON)).toEqual([13, 14, 15, 16, 17, 18, 19]);
    const source = readFileSync("components/xms/icons.tsx", "utf8");
    expect(source).toContain('viewBox="0 0 24 24"');
    expect(source).toContain("strokeWidth={1.5}");
  });
});

/**
 * No account identity square and no type colour bar, on any screen. The
 * renders draw both; the reviewer took them off outright, so a row carries
 * colour for state, priority and the clock alone and the account record names
 * its account in plain ink. The two files stay because `TicketType` and
 * `TYPE_LABEL` live in one of them, but nothing draws either component.
 */
describe("colour in a list", () => {
  const ALLOWED = ["components/xms/account-dot.tsx", "components/xms/type-bar.tsx"];

  it("draws the account and the type as plain text", () => {
    const offenders = sourceFiles()
      .filter((file) => !ALLOWED.includes(file))
      .filter((file) => /<AccountDot|<TypeBar/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("keeps state, priority and the clock coloured, which is what a row is read for", () => {
    const scope = readFileSync("styles/tokens/xms-scope.css", "utf8");
    expect(scope).toContain(".xms-state");
    expect(scope).toContain("--xms-sla-breach");
  });
});

/**
 * Every page is full width: the work area runs from the sidebar edge to the
 * window edge inside the 20px gutter, and no screen shell narrows it. Reading
 * width is capped on the control (`INPUT`), never on the page, so a form does
 * not shrink the screen it stands on.
 */
describe("the full-width rule", () => {
  it("leaves no max width or centring on a page shell", () => {
    const pages = sourceFiles().filter((file) => file.startsWith("app/") && file.endsWith("page.tsx"));
    expect(pages.length).toBeGreaterThan(40);
    const offenders = pages.filter((file) => {
      // A width cap on a skeleton, a truncating cell or a single control is
      // fine; one on the container that holds the screen is not. A control
      // says its cap in pixels (`max-w-[400px]`); a page shell reaches for
      // the named scale.
      const source = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => !/Skeleton|truncate|INPUT|title=|max-w-\[/.test(line))
        .join("\n");
      return /\bmx-auto\b|\bmax-w-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|screen|full|prose)/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("keeps no content max in the shell or the tokens", () => {
    expect(readFileSync("components/shell/shell.tsx", "utf8")).not.toMatch(/max-w-/);
    expect(readFileSync("styles/tokens/xms-scope.css", "utf8")).not.toMatch(/content-max|1200px/);
  });
});
