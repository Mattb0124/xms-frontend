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

/** Links list, add by key search (the list endpoint with q=CS…), remove (Ticket Management technical 4). */
export function LinksTab({ ticketKey, readOnly }: { ticketKey: string; readOnly?: boolean }) {
  const { data, isLoading } = useListLinksQuery(ticketKey);
  const [addLink, adding] = useAddLinkMutation();
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
    } catch (caught) {
      const parsed = apiError(caught);
      setError(parsed.code === "link_cycle" ? "That link would create a cycle." : describeError(parsed));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!readOnly ? (
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
          <button type="submit" disabled={adding.isLoading} className={PRIMARY_BUTTON}>
            Add link
          </button>
          {error ? (
            <p role="alert" className="text-[12px] text-[color:var(--state-overdue-text)]">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
      {isLoading ? <Skeleton lines={3} /> : null}
      <ul className="divide-xms-line divide-y" aria-label="Links">
        {(data ?? []).map((link) => (
          <li key={link.id} className="flex items-center gap-3 py-2 text-[13px]" data-link-type={link.type}>
            <span className="text-xms-label w-[110px]">{linkLabel(link)}</span>
            <KeyLink ticketKey={link.ticket.key} />
            <span className="text-xms-ink truncate">{link.ticket.short_description}</span>
            <StatePill state={link.ticket.state} className="ml-auto" />
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
                className={`${SECONDARY_BUTTON} h-[26px] px-2 text-[12px]`}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
        {data && data.length === 0 ? <li className="text-xms-label py-2 text-[13px]">No links.</li> : null}
      </ul>
    </div>
  );
}
