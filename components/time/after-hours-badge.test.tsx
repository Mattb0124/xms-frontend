import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AfterHoursBadge } from "@/components/time/after-hours-badge";
import { describeHandling, formatMultiplier, isStartTime, startTimeLabel } from "@/lib/time/after-hours";
import { aCompTimeContract, aContract, aPremiumContract } from "@/test-kit/tickets";
import { anAfterHoursEntry, anEntry } from "@/test-kit/time";

describe("after-hours vocabulary", () => {
  it("words the handling rule from the contract's handling and multiplier", () => {
    expect(describeHandling(aPremiumContract())).toBe("Premium 1.5x per contract");
    expect(describeHandling(aPremiumContract({ after_hours_multiplier: "2.000" }))).toBe("Premium 2x per contract");
    expect(describeHandling(aPremiumContract({ after_hours_multiplier: null }))).toBe("Premium rate per contract");
    expect(describeHandling(aCompTimeContract())).toBe("Comp time");
    expect(describeHandling(aContract())).toBeNull();
    expect(describeHandling(undefined)).toBeNull();
  });

  it("formats multipliers and start times, and accepts only HH:MM 24-hour", () => {
    expect(formatMultiplier("1.500")).toBe("1.5x");
    expect(formatMultiplier(1.25)).toBe("1.25x");
    expect(startTimeLabel("19:30:00")).toBe("19:30");
    expect(startTimeLabel(null)).toBeNull();
    expect(isStartTime("07:05")).toBe(true);
    expect(isStartTime("23:59")).toBe(true);
    expect(isStartTime("24:00")).toBe(false);
    expect(isStartTime("7:05")).toBe(false);
    expect(isStartTime("19:30:00")).toBe(false);
  });
});

describe("AfterHoursBadge", () => {
  it("renders nothing for a standard entry", () => {
    const { container } = render(<AfterHoursBadge entry={anEntry()} rule={aPremiumContract()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the class, the premium explanation and the multiplier under premium rate", () => {
    render(<AfterHoursBadge entry={anAfterHoursEntry()} rule={aPremiumContract()} />);
    expect(screen.getByText("After hours")).toHaveAttribute("data-state", "needs-input");
    expect(screen.getByText("Premium 1.5x per contract")).toBeInTheDocument();
    expect(screen.getByText("1.5x")).toBeInTheDocument();
  });

  it("shows Comp time with no multiplier under comp time", () => {
    render(
      <AfterHoursBadge
        entry={anAfterHoursEntry({ after_hours_class: "weekend", rate_multiplier: "1.000" })}
        rule={aCompTimeContract()}
      />,
    );
    expect(screen.getByText("Weekend")).toBeInTheDocument();
    expect(screen.getByText("Comp time")).toBeInTheDocument();
    expect(document.querySelector("[data-rate]")).toBeNull();
  });

  it("shows only the class under none, and the multiplier the entry carried when the contract is unknown", () => {
    const { rerender } = render(
      <AfterHoursBadge
        entry={anAfterHoursEntry({ after_hours_class: "holiday", rate_multiplier: "1.000" })}
        rule={aContract()}
      />,
    );
    expect(screen.getByText("Holiday")).toHaveAttribute("data-state", "blocked");
    expect(document.querySelector("[data-handling]")).toBeNull();
    expect(document.querySelector("[data-rate]")).toBeNull();
    rerender(<AfterHoursBadge entry={anAfterHoursEntry({ rate_multiplier: "2.000" })} />);
    expect(screen.getByText("After hours")).toBeInTheDocument();
    expect(screen.getByText("2x")).toBeInTheDocument();
    expect(document.querySelector("[data-handling]")).toBeNull();
  });
});
