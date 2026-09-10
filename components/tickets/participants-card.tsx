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
  useRemoveParticipantMutation,
  useTicketParticipantsQuery,
  type TicketParticipant,
} from "@/redux/ticketsApi";

const ROLES: { value: TicketParticipant["role"]; label: string }[] = [
  { value: "collaborator", label: "Collaborator" },
  { value: "reviewer", label: "Reviewer" },
  { value: "observer", label: "Observer" },
];

/** What a part in the ticket is called, in the words the record uses. */
export function roleLabel(role: TicketParticipant["role"]): string {
  return ROLES.find((entry) => entry.value === role)?.label ?? role;
}

/**
 * A person's line in the card: who, what part they had, and since when.
 * Somebody who has left keeps their line, with the date they left, because the
 * question the card answers is "who worked this" and not "who is here now".
 */
export function participantLine(row: TicketParticipant): string {
  const name = row.display_name || row.user_id;
  if (row.status === "left") return `${name}, left ${formatDay(row.left_at)}`;
  if (row.status === "invited") return `${name}, invited`;
  if (row.status === "declined") return `${name}, declined`;
  return name;
}

/**
 * Who had a part in this ticket besides the assignee (TM-21).
 *
 * The assignee is not on this list and cannot be added to it: the ticket
 * property says who owns the work, and repeating it here would give a reader
 * two places to look and one of them the chance to be wrong.
 *
 * People who have left stay on the list with the date they left, so the card
 * reads as the history it is. The count in the caption is distinct people,
 * which is what anybody asking "how many worked this?" means.
 */
export function ParticipantsCard({ ticketKey, readOnly }: { ticketKey: string; readOnly?: boolean }) {
  const { data, isLoading } = useTicketParticipantsQuery(ticketKey);
  const [add, addState] = useAddParticipantMutation();
  const [remove] = useRemoveParticipantMutation();
  const { push } = useToast();
  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<TicketParticipant["role"]>("collaborator");
  const { data: users = [] } = useListAssignableUsersQuery(undefined, { skip: !adding });

  const rows = useMemo(() => data?.items ?? [], [data]);
  const onTicket = useMemo(
    () => new Set(rows.filter((row) => row.status === "invited" || row.status === "active").map((row) => row.user_id)),
    [rows],
  );
  const choices = users.filter((user) => !onTicket.has(user.id));
  const contributors = data?.contributors ?? 0;

  async function submit() {
    const chosen = users.find((user) => user.id === userId);
    if (!chosen) return;
    try {
      await add({ key: ticketKey, body: { user_id: chosen.id, display_name: fullName(chosen), role } }).unwrap();
      setUserId("");
      setAdding(false);
    } catch (error) {
      push({ title: "Not added", detail: describeError(apiError(error)), tone: "error" });
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
              {!readOnly && (row.status === "active" || row.status === "invited") ? (
                <button
                  type="button"
                  onClick={() =>
                    remove({ key: ticketKey, id: row.id })
                      .unwrap()
                      .catch((error) =>
                        push({ title: "Not removed", detail: describeError(apiError(error)), tone: "error" }),
                      )
                  }
                  className="text-xms-label ml-auto hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>
            {row.joined_at ? <p className="text-xms-label text-[11px]">since {formatDay(row.joined_at)}</p> : null}
          </li>
        ))}
      </ul>
      {readOnly ? null : adding ? (
        <div className="mt-2 flex flex-col gap-2">
          <label className="sr-only" htmlFor="participant-user">
            Person
          </label>
          <select
            id="participant-user"
            className="xms-field text-[12px]"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          >
            <option value="">Choose a person</option>
            {choices.map((user) => (
              <option key={user.id} value={user.id}>
                {fullName(user)}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="participant-role">
            Part
          </label>
          <select
            id="participant-role"
            className="xms-field text-[12px]"
            value={role}
            onChange={(event) => setRole(event.target.value as TicketParticipant["role"])}
          >
            {ROLES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3 text-[12px]">
            <button type="button" className="xms-link" disabled={!userId || addState.isLoading} onClick={submit}>
              Add
            </button>
            <button
              type="button"
              className="text-xms-label hover:underline"
              onClick={() => {
                setAdding(false);
                setUserId("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="xms-link mt-2 text-[12px]" onClick={() => setAdding(true)}>
          Add somebody
        </button>
      )}
    </RailCard>
  );
}
