"use client";

import { useMemo } from "react";
import { AssigneePicker } from "@/components/tickets/assignee-picker";
import { GroupPicker } from "@/components/tickets/group-picker";
import { RecordForm, RecordRow, type RecordField, type RecordLabels } from "@/components/xms/record-form";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { describeGroupError } from "@/lib/tickets/groups";
import { scopeLabel } from "@/lib/tickets/scope";
import { formatMinutes } from "@/lib/tickets/sla";
import { LEVELS, PRIORITIES, SOURCE_LABEL, TICKET_TYPES } from "@/lib/tickets/vocab";
import { useListConfigurationItemsQuery } from "@/redux/configurationItemsApi";
import { useMe } from "@/redux/me";
import {
  useListAccountContractsQuery,
  useListGrantedAccountsQuery,
  usePatchTicketMutation,
  type PatchTicketBody,
  type TicketView,
} from "@/redux/ticketsApi";
import { useContractPositionQuery, useTicketTimeQuery, type TimeEntry } from "@/redux/timeApi";

/**
 * The one external reference the record carries, as ServiceNow prints its
 * own ("INC0448120"). `external_refs` is a map keyed by system, so several
 * are joined and an empty map reads as nothing rather than as "{}".
 */
export function externalReference(refs: Record<string, unknown>): string {
  return Object.values(refs ?? {})
    .filter((value): value is string => typeof value === "string" && value !== "")
    .join(" · ");
}

/**
 * The minutes in the billable class, from the entries the Time entries tab
 * reads. An adjusted entry counts at its adjusted minutes, which is what the
 * period would bill.
 */
export function billableMinutes(
  entries: readonly Pick<TimeEntry, "minutes" | "adjusted_minutes" | "billable_class">[],
): number {
  return entries
    .filter((entry) => entry.billable_class === "billable")
    .reduce((sum, entry) => sum + (entry.adjusted_minutes ?? entry.minutes), 0);
}

/** The instant a ServiceNow form prints beside Created: the reader's own locale, date and time. */
export function createdLabel(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** The ServiceNow case form's labels: a column of their own, right-aligned against the controls. */
const LABELS: RecordLabels = "end";

/**
 * The case form, laid out the ServiceNow way (Matt's direction 2026-09-15):
 * two columns of label-left rows, then the short description and the
 * description full width. Every editable row commits on change or blur and
 * rolls back with a toast on a refusal, as the Properties rail did.
 *
 * Left, in ServiceNow's order: Number, Channel, Ticket type, Category (its
 * Service type), Configuration item (its Primary component), Account,
 * Requester (its Contact), Contract. Right: State, Assignment group,
 * Assigned to, Impact, Urgency, Priority, Created, Created by, Total time,
 * Billable time, External reference (its Opsramp incident id), Out of scope
 * (its Budget control exception).
 *
 * The state is a value here and the state menu in the record bar is the way
 * to change it, because a transition is not a field edit: it carries a
 * reason, a confirmation and the SLA effects the server decides.
 */
export function CaseForm({ ticket, readOnly }: { ticket: TicketView; readOnly?: boolean }) {
  const me = useMe();
  const { data: accounts } = useListGrantedAccountsQuery();
  // The contract directory sits behind contracts:view; without it the row
  // keeps the ticket's own contract name rather than taking a needless 403.
  const canReadContracts = me.hasPermission("contracts:view");
  const { data: contracts } = useListAccountContractsQuery(ticket.account_id, { skip: !canReadContracts });
  // The contract's own name, from the position route, so the row never falls
  // back to a uuid. The directory is what the row needs to offer a *choice*;
  // naming the one it carries needs nothing but the ticket.
  const { data: position } = useContractPositionQuery(
    { accountId: ticket.account_id, contractId: ticket.contract_id },
    { skip: !ticket.contract_id },
  );
  const contractName = position ? `${position.contract.key} ${position.contract.name}`.trim() : "";
  // The totals ServiceNow prints on the form. One read, shared with the Time
  // entries tab through the cache, so opening that tab asks nothing more.
  const { data: time } = useTicketTimeQuery(ticket.key);
  const [patch] = usePatchTicketMutation();
  const { push } = useToast();
  const canOverride = me.hasPermission("tickets:override-priority");
  const account = accounts?.find((row) => row.id === ticket.account_id);

  // The account's register, for the row that names one. Skipped where the
  // form is read only, so a reader who cannot change the row does not fetch
  // a list to choose from; the row then reads the item's own name.
  const { data: configurationItems } = useListConfigurationItemsQuery(
    { accountId: ticket.account_id, status: "active", limit: 200 },
    { skip: readOnly },
  );

  const left = useMemo<RecordField[]>(() => {
    const items = configurationItems ?? [];
    const current = ticket.configuration_item_id;
    // The item in force stays choosable even when the register no longer
    // lists it as active, and names itself while the register is loading, so
    // the select never falls back to "Not set" over a value it holds.
    const configurationOptions = [
      { value: "", label: "Not set" },
      ...items.map((item) => ({ value: item.id, label: item.name })),
      ...(current && !items.some((item) => item.id === current)
        ? [{ value: current, label: ticket.configuration_item_name ?? "" }]
        : []),
    ];
    return [
      { key: "number", label: "Number", value: ticket.key, readOnly: true, mono: true },
      { key: "source", label: "Channel", value: SOURCE_LABEL[ticket.source] ?? ticket.source, readOnly: true },
      {
        key: "type",
        label: "Ticket type",
        value: ticket.type,
        kind: "select",
        options: TICKET_TYPES.map((type) => ({ value: type.value, label: type.label })),
        readOnly: true,
      },
      { key: "category", label: "Category", value: ticket.category ?? "", readOnly },
      readOnly
        ? {
            key: "configuration_item_id",
            label: "Configuration item",
            value: ticket.configuration_item_name ?? "",
            readOnly: true,
          }
        : {
            key: "configuration_item_id",
            label: "Configuration item",
            value: current ?? "",
            kind: "select",
            options: configurationOptions,
          },
      {
        key: "account",
        label: "Account",
        // Never the id. Until the directory answers, the row is empty and
        // says so in the words every other unset row uses.
        value: account ? `${account.key} · ${account.name}` : "",
        readOnly: true,
      },
      {
        key: "requester",
        label: "Requester",
        value: ticket.requester ? ticket.requester.display_name : "",
        readOnly: true,
      },
      // A reader who may not read the account's contract directory cannot be
      // offered the choice, so for them the row is the name and nothing else.
      // The directory must have arrived before the select is offered: the
      // value is the contract's id, and until the directory is here there is
      // no option carrying it.
      canReadContracts && !readOnly && contracts
        ? {
            key: "contract_id",
            label: "Contract",
            value: ticket.contract_id,
            kind: "select" as const,
            options: contracts.map((contract) => ({
              value: contract.id,
              label: `${contract.key} ${contract.name}`.trim(),
            })),
          }
        : { key: "contract_id", label: "Contract", value: contractName, readOnly: true },
    ];
  }, [ticket, account, contracts, contractName, canReadContracts, readOnly, configurationItems]);

  const state = useMemo<RecordField[]>(
    () => [{ key: "state", label: "State", value: ticket.state_label, readOnly: true }],
    [ticket.state_label],
  );

  const right = useMemo<RecordField[]>(
    () => [
      {
        key: "impact",
        label: "Impact",
        value: ticket.impact ?? "",
        kind: "select",
        options: [{ value: "", label: "Not set" }, ...LEVELS],
        readOnly,
      },
      {
        key: "urgency",
        label: "Urgency",
        value: ticket.urgency ?? "",
        kind: "select",
        options: [{ value: "", label: "Not set" }, ...LEVELS],
        readOnly,
      },
      {
        key: "priority",
        label: "Priority",
        value: ticket.priority,
        kind: "select",
        options: PRIORITIES.map((priority) => ({ value: priority, label: priority.toUpperCase() })),
        hint: ticket.priority_overridden ? "Overridden by hand" : "Derived from the matrix",
        readOnly: readOnly || !canOverride,
      },
      { key: "created_at", label: "Created", value: createdLabel(ticket.created_at), readOnly: true, mono: true },
      { key: "created_by", label: "Created by", value: ticket.created_by_name, readOnly: true },
      {
        key: "total_time",
        label: "Total time",
        value: time ? formatMinutes(time.total_minutes) : "",
        readOnly: true,
        mono: true,
      },
      {
        key: "billable_time",
        label: "Billable time",
        value: time ? formatMinutes(billableMinutes(time.entries)) : "",
        readOnly: true,
        mono: true,
      },
      {
        key: "external_reference",
        label: "External reference",
        value: externalReference(ticket.external_refs),
        readOnly: true,
        mono: true,
      },
      {
        key: "out_of_scope",
        label: "Out of scope",
        value: ticket.scope ? scopeLabel(ticket.scope.out_of_scope) : "No",
        readOnly: true,
      },
    ],
    [ticket, readOnly, canOverride, time],
  );

  const wide = useMemo<RecordField[]>(
    () => [
      { key: "short_description", label: "Short description", value: ticket.short_description, readOnly },
      { key: "description", label: "Description", value: ticket.description ?? "", kind: "textarea", readOnly },
    ],
    [ticket.short_description, ticket.description, readOnly],
  );

  const commit = async (key: string, value: string) => {
    const body: PatchTicketBody = { version: ticket.version };
    switch (key) {
      case "short_description":
        body.short_description = value;
        break;
      case "description":
        body.description = value === "" ? null : value;
        break;
      case "category":
        body.category = value === "" ? null : value;
        break;
      case "configuration_item_id":
        body.configuration_item_id = value === "" ? null : value;
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

  const rollback = (_key: string, _restored: string, error: unknown) => {
    const parsed = apiError(error);
    push({
      title: parsed.code === "stale_version" ? "Reloaded" : "Not saved",
      detail: describeError(parsed),
      tone: "error",
    });
  };

  return (
    <section className="xms-card flex flex-col gap-3 p-4" aria-label="Details">
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
        <RecordForm columns={1} labels={LABELS} fields={left} onCommit={commit} onRollback={rollback} />
        <div className="flex flex-col gap-3">
          <RecordForm columns={1} labels={LABELS} fields={state} onCommit={commit} onRollback={rollback} />
          {/* Reassignment (TM-08): a ticket moves to a group or to a person,
              and both are one row for one concept. They are drawn in place,
              as ServiceNow draws its Assignment group and Assigned to, rather
              than behind the text-at-rest reveal the rail needed. The group
              picker resolves the directory itself, and the assignee picker
              asks for nothing until it is focused. */}
          <RecordRow label="Assignment group" htmlFor="ticket-group" labels={LABELS} field="group">
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
          </RecordRow>
          <RecordRow label="Assigned to" htmlFor="ticket-assignee" labels={LABELS} field="assignee">
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
          </RecordRow>
          <RecordForm columns={1} labels={LABELS} fields={right} onCommit={commit} onRollback={rollback} />
        </div>
      </div>
      <RecordForm columns={1} labels={LABELS} fields={wide} onCommit={commit} onRollback={rollback} />
    </section>
  );
}
