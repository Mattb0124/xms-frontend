"use client";

import { useMemo } from "react";
import { AssigneePicker } from "@/components/tickets/assignee-picker";
import { GroupPicker } from "@/components/tickets/group-picker";
import { RecordForm, StackedReveal, type RecordField } from "@/components/xms/record-form";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { describeGroupError } from "@/lib/tickets/groups";
import { scopeLabel } from "@/lib/tickets/scope";
import { LEVELS, PRIORITIES, SOURCE_LABEL, TICKET_TYPES } from "@/lib/tickets/vocab";
import { useMe } from "@/redux/me";
import {
  useListAccountContractsQuery,
  useListDirectoryGroupsQuery,
  useListGrantedAccountsQuery,
  usePatchTicketMutation,
  type PatchTicketBody,
  type TicketView,
} from "@/redux/ticketsApi";
import { useContractPositionQuery } from "@/redux/timeApi";

/**
 * The one external reference the record carries, as the prototype prints it
 * ("INC0448120"). `external_refs` is a map keyed by system, so several are
 * joined and an empty map reads as nothing rather than as "{}".
 */
export function externalReference(refs: Record<string, unknown>): string {
  return Object.values(refs ?? {})
    .filter((value): value is string => typeof value === "string" && value !== "")
    .join(" · ");
}

/**
 * Label-left properties, commit on blur, optimistic rollback with a toast
 * on 409 (User Experience section 6). Priority is editable only with
 * tickets:override-priority; the matrix value stays visible either way.
 */
export function PropertiesPanel({ ticket, readOnly }: { ticket: TicketView; readOnly?: boolean }) {
  const me = useMe();
  const { data: accounts } = useListGrantedAccountsQuery();
  // The contract directory sits behind contracts:view; without it the row
  // keeps the ticket's own contract id rather than taking a needless 403.
  const canReadContracts = me.hasPermission("contracts:view");
  const { data: contracts } = useListAccountContractsQuery(ticket.account_id, { skip: !canReadContracts });
  // The contract's own name, from the route the rail beside this panel
  // already reads, so the row never falls back to a uuid. The directory
  // behind contracts:view is what the row needs to offer a *choice*; naming
  // the one it carries needs nothing but the ticket.
  const { data: position } = useContractPositionQuery(
    { accountId: ticket.account_id, contractId: ticket.contract_id },
    { skip: !ticket.contract_id },
  );
  const contractName = position ? `${position.contract.key} ${position.contract.name}`.trim() : "";
  const [patch] = usePatchTicketMutation();
  const { push } = useToast();
  const canOverride = me.hasPermission("tickets:override-priority");
  const account = accounts?.find((row) => row.id === ticket.account_id);
  // The group's own name, so the row reads as text at rest rather than as an
  // open select; the picker itself resolves the same directory.
  const { data: directoryGroups } = useListDirectoryGroupsQuery();
  const groupName = directoryGroups?.find((group) => group.id === ticket.group_id)?.name ?? "";

  const fields = useMemo<RecordField[]>(
    () => [
      {
        key: "account",
        label: "Account",
        // Never the id. A uuid in a property row tells the reader nothing and
        // reads as a bug; until the directory answers, the row is empty and
        // says so in the words every other unset row uses.
        value: account ? `${account.key} · ${account.name}` : "",
        readOnly: true,
      },
      {
        key: "requester",
        label: "Requester",
        value: ticket.requester ? `${ticket.requester.display_name} <${ticket.requester.email}>` : "",
        readOnly: true,
      },
      {
        key: "type",
        label: "Type",
        value: ticket.type,
        kind: "select",
        options: TICKET_TYPES.map((type) => ({ value: type.value, label: type.label })),
        readOnly: true,
      },
      { key: "category", label: "Category", value: ticket.category ?? "", readOnly },
      // The prototype puts the configuration item between Category and the
      // matrix. It is the ticket's own name for it, so the row needs no
      // second call and never prints an id.
      {
        key: "configuration_item",
        label: "Configuration item",
        value: ticket.configuration_item_name ?? "",
        readOnly: true,
      },
      // Render 02 draws impact and urgency as one row, "2 - Multiple users ·
      // 2 - High", because neither says anything without the other: they are
      // the two axes of the matrix the priority under them comes out of.
      {
        key: "impact",
        label: "Impact / urgency",
        value: ticket.impact ?? "",
        kind: "select",
        options: [{ value: "", label: "Not set" }, ...LEVELS],
        readOnly,
        second: {
          key: "urgency",
          label: "Urgency",
          value: ticket.urgency ?? "",
          kind: "select",
          options: [{ value: "", label: "Not set" }, ...LEVELS],
          readOnly,
        },
      },
      {
        key: "priority",
        label: "Priority",
        value: ticket.priority,
        kind: "select",
        options: PRIORITIES.map((priority) => ({
          value: priority,
          label: priority.toUpperCase(),
        })),
        // The matrix caption belongs beside the Priority value, not on the
        // panel, whose name is Properties (Wireframes 3.2, finding 21).
        // Render 02 reads it as one line, "P2 · derived from the matrix".
        hint: ticket.priority_overridden ? "overridden by hand" : "derived from the matrix",
        inlineHint: true,
        readOnly: readOnly || !canOverride,
      },
      // The contract sits after the priority, as it does in the render. Its
      // value is the contract's own key and name; the id it is stored under
      // is never drawn. A reader who may not read the account's contract
      // directory cannot be offered the choice, so for them the row is the
      // name and nothing else rather than a select over one bogus option
      // whose label was the uuid.
      canReadContracts && !readOnly
        ? {
            key: "contract_id",
            label: "Contract",
            value: ticket.contract_id,
            kind: "select" as const,
            options: (contracts ?? []).map((contract) => ({
              value: contract.id,
              label: `${contract.key} ${contract.name}`.trim(),
            })),
          }
        : { key: "contract_id", label: "Contract", value: contractName, readOnly: true },
    ],
    [ticket, account, contracts, contractName, canReadContracts, readOnly, canOverride],
  );

  /*
   * The rows the prototype draws under Group and Assignee: Source, then the
   * two states it names as properties. Created, Resolved and Closed are not
   * in its list at all; the instants are the Activity timeline's and the
   * Resolution tab's, which is where a reader can act on them.
   */
  const tail = useMemo<RecordField[]>(
    () => [
      { key: "source", label: "Source", value: SOURCE_LABEL[ticket.source] ?? ticket.source, readOnly: true },
      {
        key: "out_of_scope",
        label: "Out of scope",
        value: ticket.scope ? scopeLabel(ticket.scope.out_of_scope) : "No",
        readOnly: true,
      },
      {
        key: "external_reference",
        label: "External reference",
        value: externalReference(ticket.external_refs),
        readOnly: true,
        mono: true,
      },
    ],
    [ticket],
  );

  const commit = async (key: string, value: string) => {
    const body: PatchTicketBody = { version: ticket.version };
    switch (key) {
      case "category":
        body.category = value === "" ? null : value;
        break;
      case "contract_id":
        body.contract_id = value;
        break;
      case "impact":
        body.impact = value === "" ? null : (value as PatchTicketBody["impact"]);
        break;
      case "urgency":
        body.urgency = value === "" ? null : (value as PatchTicketBody["urgency"]);
        break;
      case "priority":
        body.priority = value as PatchTicketBody["priority"];
        break;
      default:
        return;
    }
    await patch({ key: ticket.key, body }).unwrap();
  };

  return (
    /*
     * The prototype's own card (`proto-v3/template.pretty.html`):
     * `border:1px solid #E4E8F5;border-radius:6px;padding:16px` with no
     * shadow, the eyebrow inside it at `margin-bottom:14px` and no rule under
     * the eyebrow. The built card put a full-width rule under the caption and
     * gave every row its own 16px horizontal padding, which drew each property
     * as a box.
     */
    <section className="xms-card flex flex-col p-4" aria-label="Properties">
      <p className="xms-caption mb-[14px]">Properties</p>
      <RecordForm
        layout="stacked"
        fields={fields}
        onCommit={commit}
        onRollback={(_key, _restored, error) => {
          const parsed = apiError(error);
          push({
            title: parsed.code === "stale_version" ? "Reloaded" : "Not saved",
            detail: describeError(parsed),
            tone: "error",
          });
        }}
      />
      {/*
        Reassignment (TM-08): a ticket moves to a group or to a person, and
        both are one row for one concept (Wireframes section 3.2, review
        finding 10), so each picker names its own current value and there is
        no second read-only line under an empty combobox. The group is a
        picker rather than a properties row because it is the queue the work
        sits in, not a field.
      */}
      <StackedReveal label="Group" value={ticket.group_id ? groupName || "No group" : "No group"} disabled={readOnly}>
        <GroupPicker
          id="ticket-group"
          aria-label="Group"
          value={ticket.group_id}
          disabled={readOnly}
          onChange={(groupId) =>
            patch({ key: ticket.key, body: { version: ticket.version, group_id: groupId } })
              .unwrap()
              .catch((error) => push({ title: "Not saved", detail: describeGroupError(error), tone: "error" }))
          }
        />
      </StackedReveal>
      <StackedReveal label="Assignee" value={ticket.assignee_name ?? "Unassigned"} disabled={readOnly}>
        <AssigneePicker
          id="ticket-assignee"
          value={ticket.assignee_id}
          valueLabel={ticket.assignee_name}
          disabled={readOnly}
          currentUserId={me.principal?.userId}
          onChange={(user) =>
            patch({ key: ticket.key, body: { version: ticket.version, assignee_id: user?.id ?? null } })
              .unwrap()
              .catch((error) => push({ title: "Not saved", detail: describeError(apiError(error)), tone: "error" }))
          }
        />
      </StackedReveal>
      <RecordForm layout="stacked" fields={tail} onCommit={commit} />
    </section>
  );
}
