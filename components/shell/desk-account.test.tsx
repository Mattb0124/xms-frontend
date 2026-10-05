import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeskAccountButton, DeskAccountMenu, DeskAccountProvider } from "@/components/shell/desk-account";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("the desk account menu", () => {
  beforeEach(() => {
    replace.mockClear();
    window.localStorage.clear();
  });

  const menu = () => {
    stubFetch({
      "GET /v1/admin/me": () =>
        json({
          principal: {
            kind: "internal",
            userId: "u1",
            displayName: "Ana Silva",
            email: "ana@hackett.com",
            accountIds: [],
            permissions: [],
          },
        }),
    });
    return renderDesk(
      <DeskAccountProvider>
        <DeskAccountButton />
        <DeskAccountMenu />
      </DeskAccountProvider>,
    );
  };

  it("names the signed-in person and signs out to the desk sign-in", async () => {
    menu();
    expect(await screen.findByText("AS")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(await screen.findByRole("menu", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    expect(screen.getByText("ana@hackett.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(replace).toHaveBeenCalledWith("/sign-in");
    expect(screen.queryByRole("menu", { name: "Account" })).not.toBeInTheDocument();
  });
});
