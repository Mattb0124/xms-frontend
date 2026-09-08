"use client";

import { useState } from "react";
import { StripSelect } from "@/components/xms/filter-select";
import { KeyLink } from "@/components/xms/key-link";
import { cn } from "@/lib/utils";

export interface DispatchOption {
  id: string;
  label: string;
  /** Capacity warning shown as a chip beside the option. */
  warning?: string;
}

export interface DispatchRowProps {
  ticketKey: string;
  shortDescription: string;
  account: { name: string; hue?: number | null };
  /** How long the request has waited: "26m", "3h", "yesterday". */
  age: string;
  groups: DispatchOption[];
  assignees: DispatchOption[];
  groupId?: string;
  assigneeId?: string;
  /** The name Axel suggests; the chip words it and pressing it takes the suggestion. */
  suggestion?: string;
  currentUserId: string;
  onConfirm: (choice: { groupId: string; assigneeId: string }) => void;
  className?: string;
}

/**
 * One unrouted request on Dispatch (v3 render 09).
 *
 * Two lines, not three: the key, the title, the account and the age on the
 * first; the group, the assignee, the suggestion or the capacity warning, and
 * Assign to me and Confirm pushed to the right on the second. Rows sit inside
 * one card and separate on a hairline, which is why this is a row and no
 * longer a card of its own: the built screen grouped them under account
 * headings with a gap between every card, and the render has neither.
 */
export function DispatchRow(props: DispatchRowProps) {
  const [groupId, setGroupId] = useState(props.groupId ?? "");
  const [assigneeId, setAssigneeId] = useState(props.assigneeId ?? "");
  const warning = props.assignees.find((option) => option.id === assigneeId)?.warning;
  const groupLabel = props.groups.find((group) => group.id === groupId)?.label ?? "Choose group";
  const assigneeLabel = props.assignees.find((person) => person.id === assigneeId)?.label ?? "Choose assignee";
  return (
    <article
      className={cn("border-xms-line-row border-b px-[18px] py-4 last:border-b-0", props.className)}
      data-key={props.ticketKey}
    >
      <div className="flex items-center gap-[14px]">
        <KeyLink ticketKey={props.ticketKey} className="w-[82px] shrink-0" />
        <span className="text-xms-ink min-w-0 flex-1 truncate text-[14px] leading-[1.45]">
          {props.shortDescription}
        </span>
        <span className="text-xms-body shrink-0 text-[13px]">{props.account.name}</span>
        {/* The age is what the row is triaged on, so it is the only figure on
            the line and it is mono. */}
        <span className="xms-mono bg-xms-chip text-xms-body shrink-0 rounded-[999px] px-[11px] py-[6px] text-[12px] leading-none font-medium">
          {props.age}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-[10px]">
        <StripSelect
          size="lg"
          ariaLabel="Group"
          value={groupId}
          display={groupLabel}
          onChange={setGroupId}
          className="min-w-[168px]"
        >
          <option value="">Choose group</option>
          {props.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </StripSelect>
        <StripSelect
          size="lg"
          ariaLabel="Assignee"
          value={assigneeId}
          display={assigneeLabel}
          onChange={setAssigneeId}
          className="min-w-[190px]"
        >
          <option value="">Choose assignee</option>
          {props.assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </StripSelect>
        {props.suggestion ? (
          // The suggestion is a control, not a label: pressing it takes it.
          // Nothing is applied until Confirm, which is the AI rule (AI-04).
          <button
            type="button"
            onClick={() => {
              const match = props.assignees.find((person) => person.label === props.suggestion);
              if (match) setAssigneeId(match.id);
            }}
            data-suggestion
            className="border-xms-note-line bg-xms-note-bg text-xms-body hover:border-xms-accent-border rounded-[999px] border px-[13px] py-2 text-[12px] font-medium whitespace-nowrap"
          >
            {`Axel suggests ${props.suggestion}`}
          </button>
        ) : null}
        {warning ? (
          <span className="aix-state-pill" data-state="needs-input">
            {warning}
          </span>
        ) : null}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setAssigneeId(props.currentUserId)}
          className="border-xms-accent-border bg-xms-card text-xms-accent hover:bg-xms-accent-tint rounded-[var(--xms-radius-control)] border px-[14px] py-[10px] text-[13px] font-medium whitespace-nowrap"
        >
          Assign to me
        </button>
        <button
          type="button"
          onClick={() => props.onConfirm({ groupId, assigneeId })}
          className="bg-xms-accent hover:bg-xms-accent-hover rounded-[var(--xms-radius-control)] px-4 py-[10px] text-[13px] font-semibold whitespace-nowrap text-white"
        >
          Confirm
        </button>
      </div>
    </article>
  );
}
