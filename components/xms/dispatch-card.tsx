"use client";

import { useState } from "react";
import { AccountDot } from "@/components/xms/account-dot";
import { KeyLink } from "@/components/xms/key-link";
import type { Priority } from "@/components/xms/priority-pill";
import { SlaValue, type SlaSnapshot } from "@/components/xms/sla-value";
import type { TicketType } from "@/components/xms/type-bar";
import { cn } from "@/lib/utils";

export interface DispatchOption {
  id: string;
  label: string;
  /** Capacity warning shown as a chip beside the option. */
  warning?: string;
}

export interface DispatchCardProps {
  ticketKey: string;
  shortDescription: string;
  account: { name: string; hue?: number | null };
  type: TicketType;
  priority: Priority;
  sla: SlaSnapshot;
  groups: DispatchOption[];
  assignees: DispatchOption[];
  groupId?: string;
  assigneeId?: string;
  /** AI suggestion chip text, e.g. "Axel: OneStream Technical · 0.82". */
  suggestion?: string;
  currentUserId: string;
  onConfirm: (choice: { groupId: string; assigneeId: string }) => void;
  className?: string;
}

const SELECT = "border-xms-line bg-xms-card text-xms-ink h-[34px] w-[168px] rounded-[6px] border px-2 text-[13px]";

/** One card per ticket on Dispatch with group and assignee pickers (Wireframes v2 section 3.4). */
export function DispatchCard(props: DispatchCardProps) {
  const [groupId, setGroupId] = useState(props.groupId ?? props.groups[0]?.id ?? "");
  const [assigneeId, setAssigneeId] = useState(props.assigneeId ?? "");
  const warning = props.assignees.find((option) => option.id === assigneeId)?.warning;
  return (
    <article className={cn("xms-card flex flex-col gap-3 p-4", props.className)} data-key={props.ticketKey}>
      {/* The render (09) reads key, title, then the account and the age on the
          right, and puts the pickers, the suggestion and the two actions on one
          row under it. The built card had the priority and the clock in the
          header and the account and type on a row of their own, which is three
          rows for what the render says in two. */}
      <header className="flex items-center gap-3">
        <KeyLink ticketKey={props.ticketKey} />
        <span className="text-xms-ink min-w-0 flex-1 truncate text-[14px] font-medium">{props.shortDescription}</span>
        <AccountDot name={props.account.name} hue={props.account.hue} className="shrink-0 text-[13px]" />
        <span className="border-xms-line bg-xms-bar text-xms-label xms-mono shrink-0 rounded-[999px] border px-[10px] py-[3px] text-[12px]">
          <SlaValue snapshot={props.sla} tickMs={0} />
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Group"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          className={SELECT}
        >
          {props.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Assignee"
          value={assigneeId}
          onChange={(event) => setAssigneeId(event.target.value)}
          className={SELECT}
        >
          <option value="">Unassigned</option>
          {props.assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </select>
        {props.suggestion ? (
          <span className="xms-ai text-xms-ai-accent rounded-[999px] px-3 py-[5px] text-[13px]" data-suggestion>
            {props.suggestion}
          </span>
        ) : null}
        {warning ? (
          <span className="aix-state-pill" data-state="needs-input">
            {warning}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setAssigneeId(props.currentUserId)}
          className="border-xms-accent-border text-xms-accent hover:bg-xms-accent-tint ml-auto h-[34px] rounded-[6px] border px-4 text-[13px] font-medium"
        >
          Assign to me
        </button>
        <button
          type="button"
          onClick={() => props.onConfirm({ groupId, assigneeId })}
          className="bg-xms-accent hover:bg-xms-accent-hover h-[34px] rounded-[6px] px-4 text-[13px] font-semibold text-white"
        >
          Confirm
        </button>
      </div>
    </article>
  );
}
