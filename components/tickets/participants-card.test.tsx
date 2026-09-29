import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantsCard, participantLine } from "@/components/tickets/participants-card";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/cases/CS1000199" }));

const LIST = "GET /v1/tickets/CS1000199/participants";
const ADD = "POST /v1/tickets/CS1000199/participants";
const INVITE = "POST /v1/tickets/CS1000199/participants/invitations";
const ACCEPT = "POST /v1/tickets/CS1000199/participants/p_mine/accept";

const me = () =>
  json({ principal: { kind: "internal", userId: "u_me", accountIds: [], permissions: ["tickets:work"] } });

const participant = (over: Record<string, unknown> = {}) => ({
  id: "p_1",
  ticket_id: "t_1",
  user_id: "u_cara",
  display_name: "Cara Diaz",
  group_id: null,
  group_name: "",
  role: "collaborator",
  status: "active",
  invited_by: "u_me",
  invited_by_name: "Owen Reed",
  responded_at: null,
  responded_by: null,
  responded_by_name: "",
  decline_reason: null,
  joined_at: "2026-09-01T14:00:00.000Z",
  left_at: null,
  created_at: "2026-09-01T14:00:00.000Z",
  can_answer: false,
  ...over,
});

const directory = {
  "GET /v1/users": () => json([{ id: "u_cara", email: "cara@x.test", first_name: "Cara", last_name: "Diaz" }]),
  "GET /v1/groups": () => json([{ id: "g_ons", name: "OneStream Technical" }]),
};

/**
 * The Participants card (TM-21 and TM-22): who had a part in the ticket
 * besides the assignee, who has been asked onto it, and the answer being the
 * invitee's own to give.
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

  it("asks a person on rather than adding them, unless told they are already working it", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me,
      [LIST]: () => json({ items: [], contributors: 0 }),
      ...directory,
      [INVITE]: () => json(participant({ status: "invited" })),
    });
    renderDesk(<ParticipantsCard ticketKey="CS1000199" />);
    fireEvent.click(await screen.findByRole("button", { name: "Ask somebody on" }));
    // Nobody chosen yet, so there is nothing to send.
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    const person = await screen.findByLabelText("Person or group");
    await waitFor(() => expect(within(person).getByText("Cara Diaz")).toBeInTheDocument());
    fireEvent.change(person, { target: { value: "u_cara" } });
    fireEvent.change(screen.getByLabelText("Part"), { target: { value: "reviewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() =>
      expect(calls.find((call) => call.key === INVITE)?.body).toEqual({
        user_id: "u_cara",
        display_name: "Cara Diaz",
        role: "reviewer",
      }),
    );
    expect(
      calls.some((call) => call.key === ADD),
      "asking is not adding",
    ).toBe(false);
  });

  it("asks a group, and does not offer to put a group straight on the ticket", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me,
      [LIST]: () => json({ items: [], contributors: 0 }),
      ...directory,
      [INVITE]: () => json(participant({ status: "invited", user_id: null, group_id: "g_ons" })),
    });
    renderDesk(<ParticipantsCard ticketKey="CS1000199" />);
    fireEvent.click(await screen.findByRole("button", { name: "Ask somebody on" }));
    const chooser = await screen.findByLabelText("Person or group");
    await waitFor(() => expect(within(chooser).getByText("OneStream Technical")).toBeInTheDocument());
    fireEvent.change(chooser, { target: { value: "g_ons" } });
    // A group cannot already be working it: one of them has to take it first.
    expect(screen.queryByLabelText("They are already working it")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() =>
      expect(calls.find((call) => call.key === INVITE)?.body).toEqual({ group_id: "g_ons", role: "collaborator" }),
    );
  });

  it("offers the answer only to the person whose invitation it is", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me,
      [LIST]: () =>
        json({
          items: [
            participant({ id: "p_mine", status: "invited", joined_at: null, can_answer: true }),
            participant({
              id: "p_theirs",
              user_id: "u_sam",
              display_name: "Sam Ortiz",
              status: "invited",
              joined_at: null,
            }),
          ],
          contributors: 0,
        }),
      [ACCEPT]: () => json(participant()),
    });
    renderDesk(<ParticipantsCard ticketKey="CS1000199" />);
    await screen.findByText("Sam Ortiz, asked");
    const card = screen.getByRole("region", { name: "Participants" });
    expect(within(card).getAllByRole("button", { name: "Accept" })).toHaveLength(1);
    // Somebody else's ask is withdrawable, not answerable.
    expect(within(card).getAllByRole("button", { name: "Withdraw" })).toHaveLength(1);
    fireEvent.click(within(card).getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(calls.some((call) => call.key === ACCEPT)).toBe(true));
  });

  it("reads the read-only record without offering to change it", async () => {
    stubFetch({ "GET /v1/admin/me": me, [LIST]: () => json({ items: [participant()], contributors: 1 }) });
    renderDesk(<ParticipantsCard ticketKey="CS1000199" readOnly />);
    await screen.findByText("Cara Diaz");
    expect(screen.queryByRole("button", { name: "Ask somebody on" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});

describe("participantLine", () => {
  it("falls back to the user id when nobody wrote a name down", () => {
    expect(participantLine(participant({ display_name: "" }) as never)).toBe("u_cara");
  });

  it("names the group when the group is who was asked", () => {
    expect(
      participantLine(
        participant({
          status: "invited",
          user_id: null,
          display_name: "",
          group_id: "g",
          group_name: "Infra",
        }) as never,
      ),
    ).toBe("Infra, asked");
  });

  it("says who accepted for a group without losing the group", () => {
    expect(participantLine(participant({ group_id: "g", group_name: "Infra", status: "active" }) as never)).toBe(
      "Cara Diaz for Infra",
    );
  });

  it("keeps a withdrawn ask apart from a decline, because they are different facts", () => {
    expect(participantLine(participant({ status: "withdrawn" }) as never)).toBe("Cara Diaz, ask withdrawn");
    expect(participantLine(participant({ status: "declined" }) as never)).toBe("Cara Diaz, declined");
  });
});
