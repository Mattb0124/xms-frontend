import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModeSwitch } from "@/components/admin/connectors/instance-header";
import { anInstance } from "@/redux/connectorsApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/connectors/x" }));

const ID = anInstance().id;

describe("ModeSwitch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers bidirectional and sends it with the version", async () => {
    const instance = anInstance({ active_state_map_id: "state-1", credential_state: "valid" });
    const calls = stubFetch({ [`PATCH /v1/connectors/${ID}`]: () => json(anInstance({ mode: "bidirectional" })) });
    renderDesk(<ModeSwitch instance={instance} />);
    const option = screen.getByRole("radio", { name: "Bidirectional" });
    expect(option).toBeEnabled();
    fireEvent.click(option);
    await waitFor(() => expect(calls[0]?.body).toEqual({ version: instance.version, mode: "bidirectional" }));
    expect(screen.queryByText(/needs an active state map/)).not.toBeInTheDocument();
  });

  it("says what the promotion still needs before the click", () => {
    renderDesk(<ModeSwitch instance={anInstance({ active_state_map_id: null })} />);
    expect(screen.getByText("Bidirectional mode needs an active state map.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Bidirectional" })).toHaveAttribute(
      "title",
      "Bidirectional mode needs an active state map.",
    );
  });

  it("names the credential when the instance has not accepted one", () => {
    renderDesk(<ModeSwitch instance={anInstance({ active_state_map_id: "state-1", credential_state: "unknown" })} />);
    expect(screen.getByText(/Run Test connection first/)).toBeInTheDocument();
  });

  it("words the API's refusal instead of failing silently", async () => {
    const instance = anInstance({ active_state_map_id: "state-1", credential_state: "valid" });
    stubFetch({
      [`PATCH /v1/connectors/${ID}`]: () => json({ code: "credential_not_valid", credential_state: "invalid" }, 409),
    });
    renderDesk(<ModeSwitch instance={instance} />);
    fireEvent.click(screen.getByRole("radio", { name: "Bidirectional" }));
    // The refusal is both toasted and left beside the switch; the inline one
    // is the one that stays.
    const shown = await screen.findAllByText(
      "The instance refused this credential. Fix it in Settings, then test the connection again.",
    );
    expect(shown.some((element) => element.hasAttribute("data-mode-refused"))).toBe(true);
  });

  it("words a missing state map when the server is the one that noticed", async () => {
    const instance = anInstance({ active_state_map_id: "state-1", credential_state: "valid" });
    stubFetch({ [`PATCH /v1/connectors/${ID}`]: () => json({ code: "no_active_state_map" }, 409) });
    renderDesk(<ModeSwitch instance={instance} />);
    fireEvent.click(screen.getByRole("radio", { name: "Bidirectional" }));
    const shown = await screen.findAllByText(
      "Bidirectional mode sends XMS states to the client, so activate a state map first.",
    );
    expect(shown.some((element) => element.hasAttribute("data-mode-refused"))).toBe(true);
  });
});
