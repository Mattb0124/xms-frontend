"use client";

import { useState } from "react";
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { KeyLink } from "@/components/xms/key-link";
import { PriorityPill } from "@/components/xms/priority-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { StatePill } from "@/components/xms/state-pill";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import {
  useAddLinkMutation,
  useLazyListTicketsQuery,
  useListLinksQuery,
  useRemoveLinkMutation,
  type TicketLink,
} from "@/redux/ticketsApi";

const LINK_TYPES: { value: TicketLink["type"]; label: string; inverse: string }[] = [
  { value: "parent", label: "Parent of", inverse: "Child of" },
  { value: "related", label: "Related to", inverse: "Related to" },
  { value: "duplicate", label: "Duplicate of", inverse: "Duplicated by" },
  { value: "blocks", label: "Blocks", inverse: "Blocked by" },
];

function linkLabel(link: TicketLink): string {
  const entry = LINK_TYPES.find((type) => type.value === link.type);
  if (!entry) return link.type;
  return link.direction === "out" ? entry.label : entry.inverse;
}

/**
 * The word render 06 puts in the pill before each key: "parent",
 * "duplicate", "related", "blocks". It is the relation, in lower case, and
 * the direction is in the row's title rather than in the pill, which the
 * render sizes for one word.
 */
function linkWord(link: TicketLink): string {
  return link.type;
}

/** Links list, add by key search (the list endpoint with q=CS…), remove (Ticket Management technical 4). */
export function LinksTab({ ticketKey, readOnly }: { ticketKey: string; readOnly?: boolean }) {
  const { data, isLoading } = useListLinksQuery(ticketKey);
  const [addLink, addState] = useAddLinkMutation();
  // The add row is behind a link, as render 06 draws it.
  const [adding, setAdding] = useState<{ open: boolean }>({ open: false });
  const [removeLink] = useRemoveLinkMutation();
  const [search] = useLazyListTicketsQuery();
  const { push } = useToast();
  const [targetKey, setTargetKey] = useState("");
  const [type, setType] = useState<TicketLink["type"]>("related");
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    const key = targetKey.trim().toUpperCase();
    if (!/^CS\d{7}$/.test(key)) {
      setError("Enter a ticket key like CS0001204.");
      return;
    }
    try {
      const found = await search({ q: key, limit: 1 }).unwrap();
      const target = found.items.find((item) => item.key === key);
      if (!target) {
        setError(`${key} was not found on your accounts.`);
        return;
      }
      await addLink({ key: ticketKey, to_ticket_id: target.id, type }).unwrap();
      setTargetKey("");
      setAdding({ open: false });
    } catch (caught) {
      const parsed = apiError(caught);
      setError(parsed.code === "link_cycle" ? "That link would create a cycle." : describeError(parsed));
    }
  };

  return (
    // Render 06 opens on the links and puts "+ Add link by key" under them.
    // The form used to stand open above an empty list, so the tab opened on
    // two controls and a button and said "No links." underneath them.
    <div className="flex flex-col gap-3">
      {isLoading ? <Skeleton lines={3} /> : null}
      <ul aria-label="Links">
        {(data ?? []).map((link) => (
          <li
            key={link.id}
            className="border-xms-line-row flex items-center gap-3 border-b py-[13px] last:border-b-0"
            data-link-type={link.type}
            title={linkLabel(link)}
          >
            <span className="xms-chip-pill w-[96px] shrink-0 justify-center">{linkWord(link)}</span>
            <KeyLink ticketKey={link.ticket.key} />
            <span className="text-xms-ink min-w-0 flex-1 truncate text-[14px]">{link.ticket.short_description}</span>
            <StatePill state={link.ticket.state} />
            <PriorityPill priority={link.ticket.priority} />
            {!readOnly ? (
              <button
                type="button"
                aria-label={`Remove link to ${link.ticket.key}`}
                onClick={() =>
                  removeLink({ key: ticketKey, linkId: link.id })
                    .unwrap()
                    .catch((caught) =>
                      push({ title: "Not removed", detail: describeError(apiError(caught)), tone: "error" }),
                    )
                }
                className="text-xms-label hover:text-xms-ink shrink-0 text-[12px]"
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
        {data && data.length === 0 ? <li className="text-xms-label py-3 text-[13px]">No links.</li> : null}
      </ul>
      {!readOnly && !adding.open ? (
        <div>
          <button type="button" onClick={() => setAdding({ open: true })} className="text-xms-accent text-[13px]">
            + Add link by key
          </button>
        </div>
      ) : null}
      {!readOnly && adding.open ? (
        <form
          aria-label="Add link"
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">This ticket</span>
            <select
              aria-label="Link type"
              value={type}
              onChange={(event) => setType(event.target.value as TicketLink["type"])}
              className={`${INPUT} w-[160px]`}
            >
              {LINK_TYPES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Ticket key</span>
            <input
              aria-label="Ticket key"
              value={targetKey}
              onChange={(event) => setTargetKey(event.target.value)}
              placeholder="CS0001204"
              className={`${INPUT} xms-mono w-[160px]`}
            />
          </label>
          <button type="submit" disabled={addState.isLoading} className={PRIMARY_BUTTON}>
            Add link
          </button>
          <button type="button" onClick={() => setAdding({ open: false })} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          {error ? (
            <p role="alert" className="w-full text-[12px] text-[color:var(--state-overdue-text)]">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
