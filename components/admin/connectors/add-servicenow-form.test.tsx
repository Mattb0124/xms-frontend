import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddServiceNowForm } from "@/components/admin/connectors/add-servicenow-form";
import { anInstance } from "@/test-kit/connectors";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/accounts/acct-1" }));

describe("AddServiceNowForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the basic credential once, then clears every field so nothing stored is ever shown", async () => {
    const calls = stubFetch({
      "POST /v1/accounts/acct-1/connectors/servicenow": () => json(anInstance(), 201),
    });
    const onCreated = vi.fn();
    renderDesk(<AddServiceNowForm accountId="acct-1" onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Brookfield CSM" } });
    fireEvent.change(screen.getByLabelText("Base URL"), { target: { value: "https://brookfield.service-now.com" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "xms" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
    fireEvent.change(screen.getByLabelText("Poll interval (s)"), { target: { value: "120" } });
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Add instance" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(calls[0].body).toEqual({
      name: "Brookfield CSM",
      base_url: "https://brookfield.service-now.com",
      auth_kind: "basic",
      credential: { username: "xms", password: "hunter2" },
      profile: "csm",
      poll_interval_seconds: 120,
    });
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("switches to OAuth fields and shows the credential_incomplete copy without keeping the secret", async () => {
    stubFetch({
      "POST /v1/accounts/acct-1/connectors/servicenow": () =>
        json({ code: "credential_incomplete", needs: ["client_id", "client_secret"] }, 400),
    });
    renderDesk(<AddServiceNowForm accountId="acct-1" />);
    fireEvent.change(screen.getByLabelText("Authentication"), { target: { value: "oauth_client_credentials" } });
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Dev" } });
    fireEvent.change(screen.getByLabelText("Base URL"), { target: { value: "https://dev.service-now.com" } });
    fireEvent.change(screen.getByLabelText("Client id"), { target: { value: "id" } });
    fireEvent.change(screen.getByLabelText("Client secret"), { target: { value: "s3cret" } });
    fireEvent.click(screen.getByRole("button", { name: "Add instance" }));
    await screen.findByText("The credential needs client_id and client_secret.");
    expect(screen.getByLabelText("Client secret")).toHaveValue("");
    expect(screen.getByLabelText("Client id")).toHaveValue("id");
  });
});
