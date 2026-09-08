"use client";

import { useMemo } from "react";
import { formatDate } from "@/components/admin/primitives";
import { AssigneePicker } from "@/components/tickets/assignee-picker";
import { Panel } from "@/components/xms/panel";
import { RecordForm, type RecordField } from "@/components/xms/record-form";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
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

/**
 * Label-left properties, commit on blur, optimistic rollback with a toast
 * on 409 (User Experience section 6). Priority is editable only with
 * tickets:override-priority; the matrix value stays visible either way.
 */
export function PropertiesPanel({ ticket, readOnly }: { ticket: TicketView; readOnly?: boolean }) {
  const me = useMe();
  const { data: accounts } = useListGrantedAccountsQuery();
  const { data: groups } = useListDirectoryGroupsQuery();
  const { data: contracts } = useListAccountContractsQuery(ticket.account_id);
  const [patch] = usePatchTicketMutation();
  const { push } = useToast();
  const canOverride = me.hasPermission("tickets:override-priority");
  const account = accounts?.find((row) => row.id === ticket.account_id);

  const fields = useMemo<RecordField[]>(
    () => [
      {
        key: "account",
        label: "Account",
        value: account ? `${account.key} · ${account.name}` : ticket.account_id,
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
      {
        key: "group_id",
        label: "Group",
        value: ticket.group_id ?? "",
        kind: "select",
        options: [
          { value: "", label: "No group" },
          ...(groups ?? []).map((group) => ({ value: group.id, label: group.name })),
        ],
        readOnly,
      },
      {
        key: "contract_id",
        label: "Contract",
        value: ticket.contract_id,
        kind: "select",
        options: (
          contracts ?? [{ id: ticket.contract_id, key: "", name: ticket.contract_id, model: "", status: "" }]
        ).map((contract) => ({ value: contract.id, label: `${contract.key} ${contract.name}`.trim() })),
        readOnly,
      },
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
        options: PRIORITIES.map((priority) => ({
          value: priority,
          label: priority.toUpperCase(),
        })),
        // The matrix caption belongs beside the Priority value, not on the
        // panel, whose name is Properties (Wireframes 3.2, finding 21).
        hint: ticket.priority_overridden ? "Overridden by hand" : "Derived from the matrix",
        readOnly: readOnly || !canOverride,
      },
      { key: "source", label: "Source", value: SOURCE_LABEL[ticket.source] ?? ticket.source, readOnly: true },
      { key: "created_at", label: "Created", value: formatDate(ticket.created_at), readOnly: true, mono: true },
      { key: "resolved_at", label: "Resolved", value: formatDate(ticket.resolved_at), readOnly: true, mono: true },
      { key: "closed_at", label: "Closed", value: formatDate(ticket.closed_at), readOnly: true, mono: true },
    ],
    [ticket, account, groups, contracts, readOnly, canOverride],
  );

  const commit = async (key: string, value: string) => {
    const body: PatchTicketBody = { version: ticket.version };
    switch (key) {
      case "category":
        body.category = value === "" ? null : value;
        break;
      case "group_id":
        body.group_id = value === "" ? null : value;
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
    <Panel title="Properties">
      <RecordForm
        columns={1}
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
        One row for one concept (Wireframes section 3.2, review finding 10):
        the picker itself names the current assignee, so there is no second
        read-only "Assigned to" line under an empty combobox.
      */}
      <div className="mt-3 grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3">
        <span className="text-xms-label text-[12px]">Assignee</span>
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
      </div>
    </Panel>
  );
}
