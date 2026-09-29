import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransitionMenu } from "@/components/tickets/transition-menu";
import { ACCOUNT_ID, aTicketView } from "@/test-kit/tickets";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/cases/CS1000199" }));

const TRANSITION = "POST /v1/tickets/CS1000199/transitions";

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u-ben", accountIds: [ACCOUNT_ID], permissions } });

/** One move on offer, needing nothing, so the menu sends it straight away. */
const transitions =
  (to = "implementing", label = "Implementing") =>
  () =>
    json({ from: "scheduled", transitions: [{ to, label, requires: [], reopen: false }] });

function stub(permissions: string[], answer: (attempt: number) => Response) {
  let attempts = 0;
  const calls = stubFetch({
    "GET /v1/admin/me": me(permissions),
    "GET /v1/tickets/CS1000199/transitions": transitions(),
    "GET /v1/tickets/CS1000199/time": () => json({ entries: [], total_minutes: 0 }),
    "GET /v1/tickets/CS1000199/solutions": () => json({ articles: [], tickets: [], resolutions: [] }),
    "GET /v1/catalogs": () => json({ resolution_codes: [], activity_types: [], billable_classes: [] }),
    [TRANSITION]: () => {
      attempts += 1;
      return answer(attempts);
    },
  });
  return calls;
}

const ticket = aTicketView({ state: "scheduled", state_label: "Scheduled" });

async function choose() {
  fireEvent.click(await screen.findByRole("button", { name: /State Scheduled, change/ }));
  fireEvent.click(await screen.findByRole("menuitem"));
}

/**
 * The change window rules on the record (TM-18). A freeze or a clash is a
 * warning any worker may acknowledge with a reason; being outside the window
 * is an override that needs `tickets:override-change-window` as well, and
 * without that permission the refusal is words alone.
 */
describe("TransitionMenu and the change window", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers the acknowledgement with a reason on a freeze, and sends the same move again with it", async () => {
    const calls = stub(["tickets:view", "tickets:work"], (attempt) =>
      attempt === 1
        ? json(
            {
              code: "change_freeze",
              window: "October release window",
              freeze: { starts_at: "2026-10-03T20:00:00Z", ends_at: "2026-10-03T21:00:00Z", reason: "Month-end close" },
            },
            409,
          )
        : json(aTicketView({ state: "implementing" })),
    );
    renderDesk(<TransitionMenu ticket={ticket} />);
    await choose();
    await screen.findByRole("form", { name: "Change window for Implementing" });
    expect(screen.getByText("Acknowledge the warning")).toBeTruthy();
    expect(screen.getByText(/Month-end close/)).toBeTruthy();

    // A wordless acknowledgement is refused here, before the API is asked again.
    fireEvent.click(screen.getByText("Acknowledge and move"));
    await screen.findByRole("alert");
    expect(calls.filter((call) => call.key === TRANSITION)).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Change window reason"), {
      target: { value: "Client accepted the risk on the call" },
    });
    fireEvent.click(screen.getByText("Acknowledge and move"));
    await waitFor(() => expect(calls.filter((call) => call.key === TRANSITION)).toHaveLength(2));
    expect(calls.filter((call) => call.key === TRANSITION)[1].body).toMatchObject({
      to: "implementing",
      change_window_reason: "Client accepted the risk on the call",
    });
  });

  it("names the tickets in the way on a clash", async () => {
    stub(["tickets:view", "tickets:work"], () =>
      json(
        {
          code: "change_conflict",
          window: "October release window",
          conflicts: [{ key: "CS1000420", group_name: "October release window" }],
        },
        409,
      ),
    );
    renderDesk(<TransitionMenu ticket={ticket} />);
    await choose();
    await screen.findByRole("form", { name: "Change window for Implementing" });
    expect(screen.getByText("Another change already holds this configuration item")).toBeTruthy();
    expect(screen.getByText("CS1000420")).toBeTruthy();
  });

  it("offers the override with its reason to a holder of the permission, and says when it is now", async () => {
    const calls = stub(["tickets:view", "tickets:work", "tickets:override-change-window"], (attempt) =>
      attempt === 1
        ? json(
            {
              code: "outside_change_window",
              window: "October release window",
              starts_at: "2026-10-03T18:00:00Z",
              ends_at: "2026-10-04T02:00:00Z",
              freeze: null,
              at: "2026-10-05T09:00:00Z",
              permission: "tickets:override-change-window",
            },
            409,
          )
        : json(aTicketView({ state: "implementing" })),
    );
    const { container } = renderDesk(<TransitionMenu ticket={ticket} />);
    await choose();
    await screen.findByRole("form", { name: "Change window for Implementing" });
    expect(screen.getByText("Override the change window")).toBeTruthy();
    expect(container.querySelector("[data-window-span]")?.textContent).toContain("and it is now");
    fireEvent.change(screen.getByLabelText("Change window reason"), { target: { value: "Sev-1 fix, CAB by email" } });
    fireEvent.click(screen.getByText("Override and move"));
    await waitFor(() => expect(calls.filter((call) => call.key === TRANSITION)).toHaveLength(2));
    expect(calls.filter((call) => call.key === TRANSITION)[1].body).toMatchObject({
      change_window_reason: "Sev-1 fix, CAB by email",
    });
  });

  it("offers no override box without the permission, and says outside_change_window in words instead", async () => {
    stub(["tickets:view", "tickets:work"], () =>
      json(
        {
          code: "outside_change_window",
          window: "October release window",
          starts_at: "2026-10-03T18:00:00Z",
          ends_at: "2026-10-04T02:00:00Z",
          at: "2026-10-05T09:00:00Z",
          permission: "tickets:override-change-window",
        },
        409,
      ),
    );
    renderDesk(<TransitionMenu ticket={ticket} />);
    await choose();
    // The toast carries the same words the sheet would have led with.
    await screen.findByText("It is outside October release window");
    expect(screen.queryByLabelText("Change window reason")).toBeNull();
  });

  it("leaves a second refusal of the same reason to the toast rather than reopening the sheet", async () => {
    stub(["tickets:view", "tickets:work"], () =>
      json({ code: "change_freeze", window: "October release window", freeze: null }, 409),
    );
    renderDesk(<TransitionMenu ticket={ticket} />);
    await choose();
    await screen.findByRole("form", { name: "Change window for Implementing" });
    fireEvent.change(screen.getByLabelText("Change window reason"), { target: { value: "Agreed with the client" } });
    fireEvent.click(screen.getByText("Acknowledge and move"));
    await screen.findByText(/is frozen over this change/);
  });
});
