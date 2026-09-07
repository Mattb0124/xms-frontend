"use client";

import { useState } from "react";
import { AccountDot } from "@/components/xms/account-dot";
import { KeyLink } from "@/components/xms/key-link";
import { PriorityPill, type Priority } from "@/components/xms/priority-pill";
import { SlaValue, type SlaSnapshot } from "@/components/xms/sla-value";
import { TypeBar, type TicketType } from "@/components/xms/type-bar";
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

const SELECT = "border-xms-line bg-xms-card text-xms-ink h-[32px] rounded-[4px] border px-2 text-[13px]";

/** One card per ticket on Dispatch with group and assignee pickers (Wireframes v2 section 3.4). */
export function DispatchCard(props: DispatchCardProps) {
  const [groupId, setGroupId] = useState(props.groupId ?? props.groups[0]?.id ?? "");
  const [assigneeId, setAssigneeId] = useState(props.assigneeId ?? "");
  const warning = props.assignees.find((option) => option.id === assigneeId)?.warning;
  return (
    <article className={cn("xms-card flex flex-col gap-3 p-4", props.className)} data-key={props.ticketKey}>
      <header className="flex items-center gap-3">
        <KeyLink ticketKey={props.ticketKey} />
        <span className="text-xms-ink truncate text-[14px] font-medium">{props.shortDescription}</span>
        <PriorityPill priority={props.priority} className="ml-auto" />
        <SlaValue snapshot={props.sla} tickMs={0} />
      </header>
      <div className="flex items-center gap-4">
        <AccountDot name={props.account.name} hue={props.account.hue} />
        <TypeBar type={props.type} />
        {props.suggestion ? (
          <span className="xms-ai text-xms-ai-accent px-2 py-[2px] text-[12px]" data-suggestion>
            {props.suggestion}
          </span>
        ) : null}
      </div>
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
        {warning ? (
          <span className="aix-state-pill" data-state="needs-input">
            {warning}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setAssigneeId(props.currentUserId)}
          className="border-xms-line text-xms-body ml-auto h-[32px] rounded-[4px] border px-3 text-[12px]"
        >
          Assign to me
        </button>
        <button
          type="button"
          onClick={() => props.onConfirm({ groupId, assigneeId })}
          className="bg-xms-accent hover:bg-xms-accent-hover h-[32px] rounded-[4px] px-3 text-[12px] font-medium text-white"
        >
          Confirm
        </button>
      </div>
    </article>
  );
}
