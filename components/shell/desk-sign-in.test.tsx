import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeskSignIn } from "@/components/shell/desk-sign-in";

vi.mock("@/lib/auth/dev-mode", () => ({
  CLERK_ENABLED: true,
  AUTH_DEV_MODE: false,
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
  SignIn: ({ forceRedirectUrl }: { forceRedirectUrl?: string }) => (
    <div data-redirect={forceRedirectUrl}>Clerk form</div>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("DeskSignIn", () => {
  it("offers the Clerk form on the desk bar", () => {
    render(<DeskSignIn />);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Use your Hackett account to open the desk.")).toBeInTheDocument();
    expect(screen.getByText("Clerk form")).toHaveAttribute("data-redirect", "/");
  });
});
