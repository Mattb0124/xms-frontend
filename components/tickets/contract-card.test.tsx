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

  /*
   * The prototype leads this card with the burn as one large mono number and
   * "of 100 h" small beside it (`proto-v3/template.pretty.html`), then the
   * meter, then one caption line. The numbers used to be the meter's own
   * label and the card's headline was the contract's key.
   */
  it("leads with the burn as one number, over the meter and one caption", () => {
    const { container } = render(<ContractCardView position={aPosition({ status: "watch" })} />);
    const burn = container.querySelector("[data-burn]")!;
    expect(burn).toHaveTextContent("10 of 40 h");
    expect(burn).toHaveClass("text-[22px]");
    expect(screen.getByText("Watch")).toHaveAttribute("data-tone", "warn");
    expect(container).toHaveTextContent("30h remaining, projected");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });
});
