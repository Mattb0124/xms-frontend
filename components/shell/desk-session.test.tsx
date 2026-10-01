import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeskSession } from "@/components/shell/desk-session";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const replace = vi.fn();
const signOut = vi.fn().mockResolvedValue(undefined);
const auth = { isLoaded: false, isSignedIn: false };

vi.mock("@/lib/auth/dev-mode", () => ({
  CLERK_ENABLED: true,
  AUTH_DEV_MODE: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/cases",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => auth,
  useUser: () => ({ user: null }),
  useClerk: () => ({ signOut }),
}));

describe("DeskSession", () => {
  beforeEach(() => {
    replace.mockClear();
    signOut.mockClear();
    auth.isLoaded = false;
    auth.isSignedIn = false;
  });

  it("sends an anonymous visitor to the desk sign-in and does not mount the shell", async () => {
    render(
      <DeskSession>
        <p>Desk body</p>
      </DeskSession>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Checking your sign-in");
    expect(screen.queryByText("Desk body")).not.toBeInTheDocument();
    auth.isLoaded = true;
    render(
      <DeskSession>
        <p>Desk body</p>
      </DeskSession>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
    expect(screen.queryByText("Desk body")).not.toBeInTheDocument();
  });

  it("shows sign-out when the API refuses the Clerk session", async () => {
    auth.isLoaded = true;
    auth.isSignedIn = true;
    stubFetch({
      "GET /v1/admin/me": () => json({ code: "unauthenticated" }, 401),
    });
    renderDesk(
      <DeskSession>
        <p>Desk body</p>
      </DeskSession>,
    );
    expect(await screen.findByRole("heading", { name: "Sign-in refused" })).toBeInTheDocument();
    expect(screen.queryByText("Desk body")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledWith({ redirectUrl: "/sign-in" });
  });
});
