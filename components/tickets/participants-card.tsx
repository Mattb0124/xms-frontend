"use client";

import { useMemo, useState } from "react";
import { fullName } from "@/components/admin/primitives";
import { RailCard } from "@/components/xms/rail-card";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { formatDay } from "@/lib/format/date";
import { useListAssignableUsersQuery } from "@/redux/adminApi";
import {
  useAddParticipantMutation,
  useAnswerInvitationMutation,
  useInviteParticipantMutation,
  useListDirectoryGroupsQuery,
  useRemoveParticipantMutation,
  useTicketParticipantsQuery,
  type ParticipantRole,
  type TicketParticipant,
} from "@/redux/ticketsApi";

const ROLES: { value: ParticipantRole; label: string }[] = [
  { value: "collaborator", label: "Collaborator" },
  { value: "reviewer", label: "Reviewer" },
  { value: "observer", label: "Observer" },
];

/** What a part in the ticket is called, in the words the record uses. */
export function roleLabel(role: ParticipantRole): string {
  return ROLES.find((entry) => entry.value === role)?.label ?? role;
}

/** Who the row is about: a person, or the group that was asked (TM-22). */
export function participantName(row: TicketParticipant): string {
  if (row.display_name) return row.display_name;
  if (row.user_id) return row.user_id;
  return row.group_name || "A group";
}

/**
 * A person's line in the card: who, and where their part stands. The three
 * ways an invitation can end are three different words, because "declined"
 * and "withdrawn" answer different questions and collapsing them would make
 * "who turned us down?" unanswerable.
 */
export function participantLine(row: TicketParticipant): string {
  const name = participantName(row);
  const forGroup = row.group_id && row.user_id ? ` for ${row.group_name}` : "";
  switch (row.status) {
    case "invited":
      return `${name}, asked`;
    case "declined":
      return `${name}, declined`;
    case "withdrawn":
      return `${name}, ask withdrawn`;
    case "left":
      return `${name}${forGroup}, left ${formatDay(row.left_at)}`;
    default:
      return `${name}${forGroup}`;
  }
}

/**
 * Who had a part in this ticket besides the assignee (TM-21), and who has
 * been asked onto it (TM-22).
 *
 * The assignee is not on this list and cannot be added to it: the ticket
 * property says who owns the work, and repeating it here would give a reader
 * two places to look and one of them the chance to be wrong. Nothing in this
 * card moves ownership, which is the point of it: what people did instead
 * was transfer the ticket to ask a question and never get it back.
 *
 * People who have left, declined or been withdrawn stay on the list, so the
 * card reads as the history it is. The count in the caption is distinct
 * people who actually worked it, so an unanswered ask counts for nobody.
 */
export function ParticipantsCard({ ticketKey, readOnly }: { ticketKey: string; readOnly?: boolean }) {
  const { data, isLoading } = useTicketParticipantsQuery(ticketKey);
  const [add] = useAddParticipantMutation();
  const [invite, inviteState] = useInviteParticipantMutation();
  const [answer] = useAnswerInvitationMutation();
  const [remove] = useRemoveParticipantMutation();
  const { push } = useToast();
  const [asking, setAsking] = useState(false);
  const [who, setWho] = useState("");
  const [role, setRole] = useState<ParticipantRole>("collaborator");
  const [already, setAlready] = useState(false);
  const { data: users = [] } = useListAssignableUsersQuery(undefined, { skip: !asking });
  const { data: groups = [] } = useListDirectoryGroupsQuery(undefined, { skip: !asking });

  const rows = useMemo(() => data?.items ?? [], [data]);
  const onTicket = useMemo(
    () => new Set(rows.filter((row) => row.status === "invited" || row.status === "active").map((row) => row.user_id)),
    [rows],
  );
  const openGroups = useMemo(
    () => new Set(rows.filter((row) => row.status === "invited").map((row) => row.group_id)),
    [rows],
  );
  const contributors = data?.contributors ?? 0;
  const person = users.find((user) => user.id === who);

  function say(title: string, error: unknown) {
    push({ title, detail: describeError(apiError(error)), tone: "error" });
  }

  /**
   * Asking and adding are one control with one switch, because from where
   * the reader stands they are the same act in two manners: "would you" and
   * "you already are". Only a person can be put straight on; a group has to
   * answer, because a group cannot do the work until one of them takes it.
   */
  async function submit() {
    if (!who) return;
    try {
      if (already && person) {
        await add({ key: ticketKey, body: { user_id: person.id, display_name: fullName(person), role } }).unwrap();
      } else {
        const body = person ? { user_id: person.id, display_name: fullName(person), role } : { group_id: who, role };
        await invite({ key: ticketKey, body }).unwrap();
      }
      setWho("");
      setAlready(false);
      setAsking(false);
    } catch (error) {
      say(already ? "Not added" : "Not asked", error);
    }
  }

  return (
    <RailCard caption={`Participants${contributors > 0 ? ` (${contributors})` : ""}`}>
      {isLoading ? <p className="text-xms-muted">Loading participants.</p> : null}
      {!isLoading && rows.length === 0 ? (
        <p className="text-xms-muted">Nobody but the assignee has worked this ticket.</p>
      ) : null}
      <ul className="divide-xms-line divide-y" data-testid="participants">
        {rows.map((row) => (
          <li key={row.id} data-participant={row.id} data-status={row.status} className="flex flex-col gap-1 py-2">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-xms-ink truncate font-medium">{participantLine(row)}</span>
              <span className="bg-xms-tint text-xms-label rounded-[999px] px-2 py-[1px] text-[11px]">
                {roleLabel(row.role)}
              </span>
              {row.can_answer ? (
                <span className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    className="xms-link"
                    onClick={() =>
                      answer({ key: ticketKey, id: row.id, answer: "accept" })
                        .unwrap()
                        .catch((error) => say("Not accepted", error))
                    }
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="text-xms-label hover:underline"
                    onClick={() =>
                      answer({ key: ticketKey, id: row.id, answer: "decline" })
                        .unwrap()
                        .catch((error) => say("Not declined", error))
                    }
                  >
                    Decline
                  </button>
                </span>
              ) : !readOnly && (row.status === "active" || row.status === "invited") ? (
                <button
                  type="button"
                  onClick={() =>
                    remove({ key: ticketKey, id: row.id })
                      .unwrap()
                      .catch((error) => say("Not removed", error))
                  }
                  className="text-xms-label ml-auto hover:underline"
                >
                  {row.status === "invited" ? "Withdraw" : "Remove"}
                </button>
              ) : null}
            </div>
            {row.status === "active" && row.joined_at ? (
              <p className="text-xms-label text-[11px]">since {formatDay(row.joined_at)}</p>
            ) : null}
            {row.status === "invited" && row.invited_by_name ? (
              <p className="text-xms-label text-[11px]">asked by {row.invited_by_name}</p>
            ) : null}
            {row.decline_reason ? <p className="text-xms-body text-[12px]">{row.decline_reason}</p> : null}
          </li>
        ))}
      </ul>
      {readOnly ? null : asking ? (
        <div className="mt-2 flex flex-col gap-2">
          <label className="sr-only" htmlFor="participant-who">
            Person or group
          </label>
          <select
            id="participant-who"
            className="xms-field text-[12px]"
            value={who}
            onChange={(event) => {
              setWho(event.target.value);
              if (!users.some((user) => user.id === event.target.value)) setAlready(false);
            }}
          >
            <option value="">Choose a person or group</option>
            <optgroup label="People">
              {users
                .filter((user) => !onTicket.has(user.id))
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {fullName(user)}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Groups">
              {groups
                .filter((group) => !openGroups.has(group.id))
                .map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
            </optgroup>
          </select>
          <label className="sr-only" htmlFor="participant-role">
            Part
          </label>
          <select
            id="participant-role"
            className="xms-field text-[12px]"
            value={role}
            onChange={(event) => setRole(event.target.value as ParticipantRole)}
          >
            {ROLES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          {person ? (
            <label className="text-xms-body flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={already} onChange={(event) => setAlready(event.target.checked)} />
              They are already working it
            </label>
          ) : null}
          <div className="flex items-center gap-3 text-[12px]">
            <button type="button" className="xms-link" disabled={!who || inviteState.isLoading} onClick={submit}>
              {already ? "Add" : "Ask"}
            </button>
            <button
              type="button"
              className="text-xms-label hover:underline"
              onClick={() => {
                setAsking(false);
                setWho("");
                setAlready(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="xms-link mt-2 text-[12px]" onClick={() => setAsking(true)}>
          Ask somebody on
        </button>
      )}
    </RailCard>
  );
}
