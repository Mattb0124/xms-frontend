import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClerkPortrait } from "@/components/xms/clerk-portrait";

const user = { hasImage: true, imageUrl: "https://img.clerk.com/me.png" };

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user }),
}));

describe("ClerkPortrait", () => {
  beforeEach(() => {
    user.hasImage = true;
    user.imageUrl = "https://img.clerk.com/me.png";
  });

  it("draws the Clerk photo inside the avatar disc", () => {
    const { container } = render(<ClerkPortrait initials="AS" />);
    const disc = container.querySelector(".aix-avatar-disc");
    expect(disc).not.toBeNull();
    expect(disc?.querySelector("img")).toHaveAttribute("src", "https://img.clerk.com/me.png");
    expect(screen.queryByText("AS")).not.toBeInTheDocument();
  });

  it("falls back to initials when Clerk has no photo", () => {
    user.hasImage = false;
    render(<ClerkPortrait initials="AS" />);
    expect(screen.getByText("AS")).toHaveClass("aix-avatar-disc");
  });
});
