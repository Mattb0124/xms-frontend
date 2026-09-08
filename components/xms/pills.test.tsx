import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountDot } from "@/components/xms/account-dot";
import { ActorChip, initials } from "@/components/xms/actor-chip";
import { KeyLink } from "@/components/xms/key-link";
import { PriorityPill } from "@/components/xms/priority-pill";
import { formatSla, SlaValue } from "@/components/xms/sla-value";
import { rampFor, StatePill } from "@/components/xms/state-pill";
import { TypeBar } from "@/components/xms/type-bar";

describe("StatePill", () => {
  it("maps state machine states onto the six-step ramp", () => {
    expect(rampFor("New")).toBe("new");
    expect(rampFor("in_progress")).toBe("in-progress");
    expect(rampFor("Awaiting Third Party")).toBe("awaiting-client");
    expect(rampFor("Known Error")).toBe("awaiting-approval");
    expect(rampFor("Fulfilled")).toBe("resolved");
    expect(rampFor("cancelled")).toBe("closed");
  });

  it("renders the ramp attribute and a readable label", () => {
    render(<StatePill state="awaiting_client" />);
    const pill = screen.getByText("Awaiting client");
    expect(pill).toHaveClass("xms-state");
    expect(pill).toHaveAttribute("data-state", "awaiting-client");
  });
});

describe("PriorityPill", () => {
  // Wireframes section 8.1: P1 red, P2 to P4 quiet. An amber P2 read as an
  // at-risk clock in a row that already carried an amber state pill.
  it("lights up P1 alone and leaves P2 to P4 quiet", () => {
    render(
      <>
        <PriorityPill priority="p1" />
        <PriorityPill priority="p2" />
        <PriorityPill priority="p3" />
      </>,
    );
    expect(screen.getByText("P1")).toHaveAttribute("data-state", "overdue");
    expect(screen.getByText("P2")).not.toHaveAttribute("data-state");
    expect(screen.getByText("P3")).not.toHaveAttribute("data-state");
  });
});

describe("TypeBar and AccountDot", () => {
  it("renders the type slug and the account hue, falling back to grey", () => {
    render(
      <>
        <TypeBar type="service_request" />
        <AccountDot name="Brookfield UK" hue={3} />
        <AccountDot name="Unknown Co" hue={9} />
      </>,
    );
    expect(screen.getByText("Request")).toHaveAttribute("data-type", "request");
    expect(screen.getByText("Brookfield UK")).toHaveAttribute("data-hue", "3");
    expect(screen.getByText("Unknown Co")).not.toHaveAttribute("data-hue");
  });
});

describe("KeyLink", () => {
  it("links to the ticket route in mono", () => {
    render(<KeyLink ticketKey="CS0001204" />);
    const link = screen.getByRole("link", { name: "CS0001204" });
    expect(link).toHaveAttribute("href", "/tickets/CS0001204");
    expect(link).toHaveClass("xms-mono");
  });
});

describe("SlaValue", () => {
  const now = new Date("2026-09-07T10:00:00Z");

  it("formats remaining, at risk, breached, paused, met and no SLA", () => {
    expect(formatSla({ dueAt: "2026-09-07T13:30:00Z" }, now)).toEqual({ label: "3h 30m", tone: "ok" });
    expect(formatSla({ dueAt: "2026-09-07T10:40:00Z" }, now)).toEqual({ label: "0h 40m", tone: "warn" });
    expect(formatSla({ dueAt: "2026-09-07T13:00:00Z", targetMinutes: 240 }, now).tone).toBe("ok");
    expect(formatSla({ dueAt: "2026-09-07T10:50:00Z", targetMinutes: 240 }, now).tone).toBe("warn");
    expect(formatSla({ dueAt: "2026-09-07T08:00:00Z" }, now)).toEqual({ label: "-2h 00m", tone: "breach" });
    expect(formatSla({ dueAt: "2026-09-09T12:00:00Z" }, now)).toEqual({ label: "2d 02h", tone: "ok" });
    // Render 08's column reads "paused" on its own: a paused clock has no
    // remaining time to count, so a figure beside the word would be elapsed
    // time, which this column never shows.
    expect(formatSla({ dueAt: "2026-09-07T13:00:00Z", paused: true }, now)).toEqual({
      label: "paused",
      tone: "paused",
    });
    // An overdue clock says how far past due it is, not the word "Breached":
    // the number is what decides which breach is picked up first.
    expect(formatSla({ dueAt: "2026-09-07T08:00:00Z", breached: true }, now)).toEqual({
      label: "-2h 00m",
      tone: "breach",
    });
    // The word is kept for the two cases the number cannot answer: a latched
    // breach whose due time is not in the past (a reopened ticket), and a
    // breach with no due time at all.
    expect(formatSla({ dueAt: "2026-09-07T13:00:00Z", breached: true }, now)).toEqual({
      label: "Breached",
      tone: "breach",
    });
    expect(formatSla({ dueAt: null, breached: true }, now)).toEqual({ label: "Breached", tone: "breach" });
    expect(formatSla({ dueAt: "2026-09-07T08:00:00Z", met: true }, now)).toEqual({ label: "Met", tone: "met" });
    expect(formatSla({ dueAt: null }, now)).toEqual({ label: "No SLA", tone: "none" });
  });

  it("draws the signal as a dot beside an ink value where the row asks for one", () => {
    // Render 08's Needs attention rows: an 8px dot, then the mono value in
    // ink. In a table cell the value carries the colour itself.
    const { container } = render(<SlaValue snapshot={{ dueAt: "2026-09-07T08:00:00Z" }} now={now} tickMs={0} dot />);
    expect(screen.getByText("-2h 00m")).toHaveAttribute("data-tone", "breach");
    expect(screen.getByText("-2h 00m")).toHaveClass("text-xms-ink");
    expect(container.querySelector("span[aria-hidden]")).toHaveClass("bg-[color:var(--xms-sla-breach)]");
  });

  /*
   * The chip in the record bar speaks the clock ("Resolution 3h 12m left",
   * proto-v3/template.pretty.html). Spoken, a breach is breached by an amount:
   * the bare minus sign is the list column's treatment, read against a column
   * of numbers, and in a sentence it reads as a negative amount of time left.
   */
  it("names the clock and words a breach when it is spoken", () => {
    const { rerender } = render(
      <SlaValue snapshot={{ dueAt: "2026-09-07T13:30:00Z" }} now={now} tickMs={0} dot verbose kind="Resolution" />,
    );
    expect(screen.getByText("Resolution 3h 30m left")).toBeInTheDocument();
    rerender(
      <SlaValue snapshot={{ dueAt: "2026-09-07T08:00:00Z" }} now={now} tickMs={0} dot verbose kind="Response" />,
    );
    expect(screen.getByText("Response breached by 2h 00m")).toBeInTheDocument();
    // The list column is unchanged: no word, no name, the minus sign kept.
    rerender(<SlaValue snapshot={{ dueAt: "2026-09-07T08:00:00Z" }} now={now} tickMs={0} />);
    expect(screen.getByText("-2h 00m")).toBeInTheDocument();
  });

  it("renders in mono with the tone attribute", () => {
    render(<SlaValue snapshot={{ dueAt: "2026-09-07T08:00:00Z" }} now={now} tickMs={0} />);
    const value = screen.getByText("-2h 00m");
    expect(value).toHaveClass("xms-mono");
    expect(value).toHaveAttribute("data-tone", "breach");
  });
});

describe("ActorChip", () => {
  it("shows initials for people and the violet AX badge for Axel", () => {
    expect(initials("Maria Da Silva")).toBe("MD");
    render(
      <>
        <ActorChip name="Maria Da Silva" />
        <ActorChip name="Axel" kind="ai" />
      </>,
    );
    expect(screen.getByText("MD")).toBeInTheDocument();
    expect(screen.getByText("AX")).toHaveClass("bg-xms-ai-bg");
  });
});
