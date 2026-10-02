import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeskSignIn } from "@/components/shell/desk-sign-in";

const replace = vi.fn();
const password = vi.fn();
const signIn = {
  status: "complete" as string | null,
  password,
  finalize: vi.fn().mockResolvedValue({ error: null }),
  create: vi.fn(),
  resetPasswordEmailCode: {
    sendCode: vi.fn(),
    verifyCode: vi.fn(),
    submitPassword: vi.fn(),
  },
};

vi.mock("@/lib/auth/dev-mode", () => ({
  CLERK_ENABLED: true,
  AUTH_DEV_MODE: false,
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
  useSignIn: () => ({ signIn }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("DeskSignIn", () => {
  beforeEach(() => {
    password.mockReset();
    replace.mockReset();
    password.mockResolvedValue({ error: null });
    signIn.status = "complete";
  });

  it("offers the same email and password form as the web UI", () => {
    render(<DeskSignIn />);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("to continue to X Managed Services")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("signs in with the email and password and reloads the desk", async () => {
    render(<DeskSignIn />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ana@hackett.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(password).toHaveBeenCalledWith({ identifier: "ana@hackett.com", password: "secret" });
    await screen.findByRole("button", { name: "Continue" });
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("opens the reset flow from Forgot password", () => {
    render(<DeskSignIn />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("heading", { name: "Reset password" })).toBeInTheDocument();
  });
});
