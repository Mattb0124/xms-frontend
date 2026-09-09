import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it } from "vitest";
import { DANGER_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { cn } from "@/lib/utils";

/**
 * The primary action rendered as a solid accent rectangle with no visible
 * label on every list screen: an unlayered `a { color: var(--xms-accent) }`
 * beat `text-white` (frontend review finding 4). The cascade itself is pinned
 * in styles/tokens/tokens.test.ts; here the button contract is pinned, so a
 * link wearing it always declares its own foreground rather than inheriting
 * the accent link colour.
 */
describe("the header bar buttons", () => {
  it("gives the primary action a white label on the accent ground, at rest and on hover", () => {
    render(
      <Link href="/cases/new" className={cn(PRIMARY_BUTTON, "inline-flex items-center")}>
        + New ticket
      </Link>,
    );
    const action = screen.getByRole("link", { name: "+ New ticket" });
    const classes = action.className.split(/\s+/);
    expect(classes).toContain("text-white");
    expect(classes).toContain("hover:text-white");
    expect(classes).toContain("bg-xms-accent");
    // The accent foreground on the accent ground is the 1:1 contrast defect.
    expect(classes).not.toContain("text-xms-accent");
  });

  it("keeps a link-styled action from underlining like body copy", () => {
    for (const button of [PRIMARY_BUTTON, SECONDARY_BUTTON]) {
      expect(button.split(/\s+/)).toContain("hover:no-underline");
    }
  });

  it("states a foreground on every button variant, so none inherits the link colour", () => {
    for (const [name, button] of Object.entries({ PRIMARY_BUTTON, SECONDARY_BUTTON, DANGER_BUTTON })) {
      expect(/(^|\s)text-(white|xms-|\[color:)/.test(button), `${name} declares no foreground`).toBe(true);
    }
  });
});
