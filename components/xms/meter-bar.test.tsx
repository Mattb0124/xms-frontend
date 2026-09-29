import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MeterBar } from "@/components/xms/meter-bar";

/**
 * Amber is the at-risk signal. A met clock fills to 100 and used to land in
 * the at-risk band, so "Response met", "Resolution met" and 100 percent SLA
 * attainment all drew amber and a healthy ticket read as a warning
 * (frontend review finding 11, Design System section 3.2).
 */
function fillOf(): string {
  const bar = screen.getByRole("progressbar");
  const fill = bar.firstElementChild as HTMLElement;
  return fill.style.background;
}

describe("MeterBar", () => {
  it("draws a met clock on the complete trio, not amber", () => {
    render(<MeterBar percent={100} met />);
    expect(fillOf()).toBe("var(--state-complete-text)");
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-met", "true");
  });

  it("keeps amber for the at-risk band only", () => {
    render(<MeterBar percent={80} />);
    expect(fillOf()).toBe("var(--xms-sla-warn)");
  });

  it("keeps the accent below the at-risk band", () => {
    render(<MeterBar percent={40} />);
    expect(fillOf()).toBe("var(--xms-accent)");
  });

  it("keeps red for a breach, even when met is passed", () => {
    render(<MeterBar percent={120} breached met />);
    const bar = screen.getByRole("progressbar");
    expect(fillOf()).toBe("var(--state-overdue-text)");
    expect(bar).toHaveAttribute("data-breached", "true");
    expect(bar).not.toHaveAttribute("data-met");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });
});
