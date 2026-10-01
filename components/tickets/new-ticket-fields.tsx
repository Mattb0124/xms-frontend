"use client";

import { FieldRow, INPUT } from "@/components/admin/primitives";
import { AssigneePicker } from "@/components/tickets/assignee-picker";
import { Panel } from "@/components/xms/panel";
import { PriorityPill, type Priority } from "@/components/xms/priority-pill";
import type { TicketType } from "@/components/xms/type-bar";
import { LEVELS, TICKET_TYPES, type Level } from "@/lib/tickets/vocab";
import type { DirectoryGroup, GrantedAccount } from "@/redux/ticketsApi";

export interface NewTicketDraft {
  account_id: string;
  requester_email: string;
  requester_name: string;
  type: TicketType;
  category: string;
  group_id: string;
  assignee_id: string;
  contract_id: string;
  impact: Level | "";
  urgency: Level | "";
  short_description: string;
  description: string;
}

export const EMPTY_TICKET_DRAFT: NewTicketDraft = {
  account_id: "",
  requester_email: "",
  requester_name: "",
  type: "incident",
  category: "",
  group_id: "",
  assignee_id: "",
  contract_id: "",
  impact: "",
  urgency: "",
  short_description: "",
  description: "",
};

interface NamedContract {
  id: string;
  key: string;
  name: string;
}

function contractPrompt(contracts: NamedContract[], canReadContracts: boolean): string {
  if (contracts.length > 0) return "Choose a contract";
  if (canReadContracts) return "No active contract";
  return "Contracts need the contracts:view permission";
}

export interface NewTicketWhoProps {
  draft: NewTicketDraft;
  accountId: string;
  contractId: string;
  activeAccounts: GrantedAccount[];
  contracts: NamedContract[];
  canReadContracts: boolean;
  groups: DirectoryGroup[] | undefined;
  currentUserId: string | undefined;
  onChange: (patch: Partial<NewTicketDraft>) => void;
}

/** The account, the requester, the contract and who the case is handed to. */
export function NewTicketWho({
  draft,
  accountId,
  contractId,
  activeAccounts,
  contracts,
  canReadContracts,
  groups,
  currentUserId,
  onChange,
}: NewTicketWhoProps) {
  return (
    <Panel title="Who and where">
      <div className="flex flex-col gap-3">
        <FieldRow label="Account *" htmlFor="account">
          <select
            id="account"
            required
            value={accountId}
            onChange={(event) => onChange({ account_id: event.target.value, contract_id: "" })}
            className={INPUT}
          >
            <option value="">Choose an account</option>
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.key} · {account.name}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Requester email" htmlFor="requester-email">
          <input
            id="requester-email"
            type="email"
            value={draft.requester_email}
            onChange={(event) => onChange({ requester_email: event.target.value })}
            className={INPUT}
          />
        </FieldRow>
        <FieldRow label="Requester name" htmlFor="requester-name">
          <input
            id="requester-name"
            value={draft.requester_name}
            onChange={(event) => onChange({ requester_name: event.target.value })}
            className={INPUT}
          />
        </FieldRow>
        <FieldRow label="Contract *" htmlFor="contract">
          <select
            id="contract"
            value={contractId}
            onChange={(event) => onChange({ contract_id: event.target.value })}
            className={INPUT}
            disabled={!accountId}
          >
            <option value="">{contractPrompt(contracts, canReadContracts)}</option>
            {contracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.key} · {contract.name}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Group" htmlFor="group">
          <select
            id="group"
            value={draft.group_id}
            onChange={(event) => onChange({ group_id: event.target.value })}
            className={INPUT}
          >
            <option value="">No group</option>
            {(groups ?? []).map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Assignee" htmlFor="assignee">
          <AssigneePicker
            id="assignee"
            value={draft.assignee_id || null}
            currentUserId={currentUserId}
            onChange={(user) => onChange({ assignee_id: user?.id ?? "" })}
          />
        </FieldRow>
      </div>
    </Panel>
  );
}

function ticketTypeOf(value: string): TicketType {
  return TICKET_TYPES.find((type) => type.value === value)?.value ?? "incident";
}

function levelOf(value: string): Level | "" {
  if (value === "") return "";
  return LEVELS.find((level) => level.value === value)?.value ?? "";
}

export interface NewTicketClassificationProps {
  draft: NewTicketDraft;
  priority: Priority;
  onChange: (patch: Partial<NewTicketDraft>) => void;
}

/** Type, category, impact and urgency, with the priority the matrix derives. */
export function NewTicketClassification({ draft, priority, onChange }: NewTicketClassificationProps) {
  return (
    <Panel title="Classification">
      <div className="flex flex-col gap-3">
        <FieldRow label="Type *" htmlFor="type">
          <select
            id="type"
            value={draft.type}
            onChange={(event) => onChange({ type: ticketTypeOf(event.target.value) })}
            className={INPUT}
          >
            {TICKET_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Category" htmlFor="category">
          <input
            id="category"
            value={draft.category}
            onChange={(event) => onChange({ category: event.target.value })}
            className={INPUT}
          />
        </FieldRow>
        <FieldRow label="Impact" htmlFor="impact">
          <select
            id="impact"
            value={draft.impact}
            onChange={(event) => onChange({ impact: levelOf(event.target.value) })}
            className={INPUT}
          >
            <option value="">Not set</option>
            {LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Urgency" htmlFor="urgency">
          <select
            id="urgency"
            value={draft.urgency}
            onChange={(event) => onChange({ urgency: levelOf(event.target.value) })}
            className={INPUT}
          >
            <option value="">Not set</option>
            {LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Priority">
          <span className="flex items-center gap-2" data-testid="priority-preview">
            <PriorityPill priority={priority} />
            <span className="text-xms-label text-body">
              {draft.impact && draft.urgency ? "derived from the matrix" : "default until impact and urgency are set"}
            </span>
          </span>
        </FieldRow>
      </div>
    </Panel>
  );
}
