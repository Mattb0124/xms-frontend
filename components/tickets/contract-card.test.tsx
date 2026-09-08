import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContractCardView, hoursText, positionTone } from "@/components/tickets/contract-card";
import { aPosition } from "@/test-kit/time";

describe("contract card", () => {
  it("maps the server status to the tone", () => {
    expect(positionTone("on_track")).toBe("good");
    expect(positionTone("watch")).toBe("warn");
    expect(positionTone("over")).toBe("breach");
    expect(hoursText(90)).toBe("1.5h");
    expect(hoursText(2400)).toBe("40h");
  });

  it("renders consumed against available with the remaining and projected hours", () => {
    render(<ContractCardView position={aPosition({ status: "watch" })} />);
    expect(screen.getByText("10h of 40h this period")).toBeInTheDocument();
    expect(screen.getByText("Watch")).toHaveAttribute("data-tone", "warn");
    expect(screen.getByText("30h")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });
});
