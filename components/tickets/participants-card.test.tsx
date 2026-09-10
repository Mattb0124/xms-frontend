import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantsCard, participantLine } from "@/components/tickets/participants-card";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/cases/CS1000199" }));

const LIST = "GET /v1/tickets/CS1000199/participants";
const ADD = "POST /v1/tickets/CS1000199/participants";

const me = () =>
  json({ principal: { kind: "internal", userId: "u_me", accountIds: [], permissions: ["tickets:work"] } });

const participant = (over: Record<string, unknown> = {}) => ({
  id: "p_1",
  ticket_id: "t_1",
  user_id: "u_cara",
  display_name: "Cara Diaz",
  role: "collaborator",
  status: "active",
  invited_by: "u_me",
  invited_by_name: "Owen Reed",
  joined_at: "2026-09-01T14:00:00.000Z",
  left_at: null,
  created_at: "2026-09-01T14:00:00.000Z",
  ...over,
});

/**
 * The Participants card (TM-21): who had a part in the ticket besides the
 * assignee, the people who have left kept on the list, and the count read as
 * distinct people.
 */
describe("ParticipantsCard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("says plainly when only the assignee has worked the ticket", async () => {
    stubFetch({ "GET /v1/admin/me": me, [LIST]: () => json({ items: [], contributors: 0 }) });
    renderDesk(<ParticipantsCard ticketKey="CS1000199" />);
    await screen.findByText("Nobody but the assignee has worked this ticket.");
    // No count in the caption when there is nothing to count.
    expect(screen.getByRole("region", { name: "Participants" })).toBeInTheDocument();
  });

  it("keeps somebody who left on the list, with the date and no way to remove them again", async () => {
    stubFetch({
      "GET /v1/admin/me": me,
      [LIST]: () =>
        json({
          items: [
            participant(),
            participant({
              id: "p_2",
              user_id: "u_sam",
              display_name: "Sam Ortiz",
              role: "reviewer",
              status: "left",
              left_at: "2026-09-08T10:00:00.000Z",
            }),
          ],
          contributors: 2,
        }),
    });
    renderDesk(<ParticipantsCard ticketKey="CS1000199" />);
    const card = await screen.findByRole("region", { name: "Participants (2)" });
    expect(within(card).getByText("Cara Diaz")).toBeInTheDocument();
    expect(within(card).getByText("Sam Ortiz, left 09/08/2026")).toBeInTheDocument();
    expect(within(card).getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("adds a person with the part they had, and asks for both before it will send", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me,
      [LIST]: () => json({ items: [], contributors: 0 }),
      "GET /v1/users": () => json([{ id: "u_cara", email: "cara@x.test", first_name: "Cara", last_name: "Diaz" }]),
      [ADD]: () => json(participant()),
    });
    renderDesk(<ParticipantsCard ticketKey="CS1000199" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add somebody" }));
    // Nobody chosen yet, so there is nothing to send.
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    const person = await screen.findByLabelText("Person");
    await waitFor(() => expect(within(person).getByText("Cara Diaz")).toBeInTheDocument());
    fireEvent.change(person, { target: { value: "u_cara" } });
    fireEvent.change(screen.getByLabelText("Part"), { target: { value: "reviewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(calls.find((call) => call.key === ADD)?.body).toEqual({
        user_id: "u_cara",
        display_name: "Cara Diaz",
        role: "reviewer",
      }),
    );
  });

  it("reads the read-only record without offering to change it", async () => {
    stubFetch({ "GET /v1/admin/me": me, [LIST]: () => json({ items: [participant()], contributors: 1 }) });
    renderDesk(<ParticipantsCard ticketKey="CS1000199" readOnly />);
    await screen.findByText("Cara Diaz");
    expect(screen.queryByRole("button", { name: "Add somebody" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});

describe("participantLine", () => {
  it("falls back to the user id when nobody wrote a name down", () => {
    expect(participantLine(participant({ display_name: "" }) as never)).toBe("u_cara");
  });

  it("says what an invitation is waiting on, which is TM-22's state", () => {
    expect(participantLine(participant({ status: "invited" }) as never)).toBe("Cara Diaz, invited");
  });
});
