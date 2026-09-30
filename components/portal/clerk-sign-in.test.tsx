import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClerkSignIn } from "@/components/portal/clerk-sign-in";

const replace = vi.fn();
const auth = { isLoaded: true, isSignedIn: false };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => auth,
  SignIn: () => <div>Clerk form</div>,
}));

describe("ClerkSignIn", () => {
  beforeEach(() => {
    replace.mockClear();
    auth.isLoaded = true;
    auth.isSignedIn = false;
  });

  it("shows the form when nobody is signed in", () => {
    render(<ClerkSignIn />);
    expect(screen.getByText("Clerk form")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not mount the form when Clerk already has a session", () => {
    auth.isSignedIn = true;
    render(<ClerkSignIn />);
    expect(screen.queryByText("Clerk form")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/portal");
  });
});
