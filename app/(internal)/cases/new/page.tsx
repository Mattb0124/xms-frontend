"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AdminGate,
  FieldRow,
  INPUT,
  InlineError,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from "@/components/admin/primitives";
import { HeaderAction } from "@/components/shell/content-header-bar";
import { AssigneePicker } from "@/components/tickets/assignee-picker";
import { DropZone } from "@/components/tickets/attachments";
import { formatBytes, uploadAttachment } from "@/lib/attachments/upload";
import { Panel } from "@/components/xms/panel";
import { PriorityPill } from "@/components/xms/priority-pill";
import { useToast } from "@/components/xms/toast";
import type { TicketType } from "@/components/xms/type-bar";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import { derivePriority } from "@/lib/tickets/priority";
import { LEVELS, TICKET_TYPES, type Level } from "@/lib/tickets/vocab";
import { useMe } from "@/redux/me";
import {
  useCreateTicketMutation,
  useListAccountContractsQuery,
  useListDirectoryGroupsQuery,
  useListGrantedAccountsQuery,
  type CreateTicketBody,
} from "@/redux/ticketsApi";

interface Draft {
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

const EMPTY: Draft = {
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

/** The full-screen record form (User Experience 3.3): label-left grid, live priority preview, one submit. */
function NewTicketForm() {
  const router = useRouter();
  const me = useMe();
  const { push } = useToast();
  const track = useTrack("ticket.create");
  const { data: accounts } = useListGrantedAccountsQuery();
  const { data: groups } = useListDirectoryGroupsQuery();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  // Defaults are derived, never set: the only granted account and the only
  // active contract apply until the user chooses otherwise.
  const activeAccounts = useMemo(() => (accounts ?? []).filter((account) => account.status === "active"), [accounts]);
  const accountId = draft.account_id || (activeAccounts.length === 1 ? activeAccounts[0].id : "");
  // The contract list is behind contracts:view; a creator without it names no
  // contract here and takes the server's choices from the refusal instead.
  const canReadContracts = me.hasPermission("contracts:view");
  const { data: contracts } = useListAccountContractsQuery(accountId, { skip: !accountId || !canReadContracts });
  const activeContracts = useMemo(
    () => (contracts ?? []).filter((contract) => contract.status === "active"),
    [contracts],
  );
  const contractId = draft.contract_id || (activeContracts.length === 1 ? activeContracts[0].id : "");
  const [create, { isLoading }] = useCreateTicketMutation();
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [contractChoices, setContractChoices] = useState<{ id: string; key: string; name: string }[] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const priority = derivePriority(draft.impact, draft.urgency);
  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const submit = async () => {
    setError(null);
    setDetails([]);
    const body: CreateTicketBody = {
      account_id: accountId,
      type: draft.type,
      short_description: draft.short_description.trim(),
      description: draft.description.trim() || undefined,
      category: draft.category.trim() || undefined,
      impact: draft.impact || undefined,
      urgency: draft.urgency || undefined,
      group_id: draft.group_id || undefined,
      assignee_id: draft.assignee_id || undefined,
      contract_id: contractId || undefined,
      requester_email: draft.requester_email.trim() || undefined,
      requester_name: draft.requester_name.trim() || undefined,
    };
    try {
      const ticket = await create(body).unwrap();
      track({ type: ticket.type, priority: ticket.priority });
      if (files.length > 0) {
        // The ticket exists now; the queued files go up one by one and any refusal is reported, never blocking.
        setUploading(true);
        let failed = 0;
        for (const file of files) {
          try {
            await uploadAttachment(ticket.key, file, { visibility: "public" });
          } catch {
            failed += 1;
          }
        }
        setUploading(false);
        push({
          title: `${ticket.key} created`,
          detail:
            failed > 0
              ? `${failed} file${failed === 1 ? "" : "s"} could not be attached.`
              : `${files.length} file${files.length === 1 ? "" : "s"} attached.`,
          tone: failed > 0 ? "error" : "success",
        });
      } else {
        push({ title: `${ticket.key} created`, tone: "success" });
      }
      router.push(`/cases/${ticket.key}`);
    } catch (caught) {
      const parsed = apiError(caught);
      const data = (caught as { data?: { choices?: { id: string; key: string; name: string }[] } })?.data;
      if (parsed.code === "contract_required" && data?.choices) {
        setContractChoices(data.choices);
        setError("This account has more than one active contract; choose one.");
      } else if (parsed.code === "no_active_contract") {
        setError("Set up a contract on this account to start taking tickets.");
      } else {
        setError(describeError(parsed));
        setDetails(parsed.details ?? []);
      }
    }
  };

  const canSubmit = accountId !== "" && draft.short_description.trim() !== "" && !isLoading && !uploading;

  return (
    <form
      id="new-ticket"
      className="flex flex-col gap-4"
      aria-label="New ticket"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) void submit();
      }}
    >
      {/* The screen was named twice, "New ticket" on the strip and "Ticket ·
          New record" in a title row under it, with a back link to the Cases list the ticket
          record itself already dropped. The two actions are the screen's, so
          they stand in the toolbar right, which is where Quarantine's own
          title row went in pass three. */}
      <HeaderAction>
        <Link href="/cases" className={`${SECONDARY_BUTTON} inline-flex items-center`}>
          Cancel
        </Link>
        <button type="submit" form="new-ticket" disabled={!canSubmit} className={PRIMARY_BUTTON}>
          Submit
        </button>
      </HeaderAction>
      {error ? (
        <div className="rounded-[6px] border border-[color:var(--state-overdue-border)] bg-[color:var(--state-overdue-bg)] px-4 py-2">
          <InlineError message={error} />
          {details.map((detail) => (
            <p key={detail} className="text-xms-label text-[14px]">
              {detail}
            </p>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Who and where">
          <div className="flex flex-col gap-3">
            <FieldRow label="Account *" htmlFor="account">
              <select
                id="account"
                required
                value={accountId}
                onChange={(event) => update({ account_id: event.target.value, contract_id: "" })}
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
                onChange={(event) => update({ requester_email: event.target.value })}
                className={INPUT}
              />
            </FieldRow>
            <FieldRow label="Requester name" htmlFor="requester-name">
              <input
                id="requester-name"
                value={draft.requester_name}
                onChange={(event) => update({ requester_name: event.target.value })}
                className={INPUT}
              />
            </FieldRow>
            <FieldRow label="Contract *" htmlFor="contract">
              <select
                id="contract"
                value={contractId}
                onChange={(event) => update({ contract_id: event.target.value })}
                className={INPUT}
                disabled={!accountId}
              >
                <option value="">
                  {(contractChoices ?? activeContracts).length > 0
                    ? "Choose a contract"
                    : canReadContracts
                      ? "No active contract"
                      : "Contracts need the contracts:view permission"}
                </option>
                {(contractChoices ?? activeContracts).map((contract) => (
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
                onChange={(event) => update({ group_id: event.target.value })}
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
                currentUserId={me.principal?.userId}
                onChange={(user) => update({ assignee_id: user?.id ?? "" })}
              />
            </FieldRow>
          </div>
        </Panel>
        <Panel title="Classification">
          <div className="flex flex-col gap-3">
            <FieldRow label="Type *" htmlFor="type">
              <select
                id="type"
                value={draft.type}
                onChange={(event) => update({ type: event.target.value as TicketType })}
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
                onChange={(event) => update({ category: event.target.value })}
                className={INPUT}
              />
            </FieldRow>
            <FieldRow label="Impact" htmlFor="impact">
              <select
                id="impact"
                value={draft.impact}
                onChange={(event) => update({ impact: event.target.value as Level | "" })}
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
                onChange={(event) => update({ urgency: event.target.value as Level | "" })}
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
                <span className="text-xms-label text-[14px]">
                  {draft.impact && draft.urgency
                    ? "derived from the matrix"
                    : "default until impact and urgency are set"}
                </span>
              </span>
            </FieldRow>
          </div>
        </Panel>
      </div>
      <Panel title="Description">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[14px]">
            <span className="text-xms-label">Short description *</span>
            <input
              required
              maxLength={300}
              value={draft.short_description}
              onChange={(event) => update({ short_description: event.target.value })}
              className={INPUT}
              aria-label="Short description"
            />
          </label>
          <label className="flex flex-col gap-1 text-[14px]">
            <span className="text-xms-label">Description</span>
            <textarea
              rows={6}
              value={draft.description}
              onChange={(event) => update({ description: event.target.value })}
              className={`${INPUT} h-auto py-2`}
              aria-label="Description"
            />
          </label>
        </div>
      </Panel>
      <Panel title="Files" caption="Uploaded and scanned once the ticket exists">
        <div className="flex flex-col gap-2">
          <DropZone
            onFiles={(list) => setFiles((current) => [...current, ...Array.from(list)])}
            disabled={isLoading || uploading}
          />
          {files.length > 0 ? (
            <ul className="flex flex-col gap-1" aria-label="Queued files">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-[14px]">
                  <span className="text-xms-ink">{file.name}</span>
                  <span className="xms-mono text-xms-label">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    className="text-xms-label ml-auto hover:underline"
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Panel>
    </form>
  );
}

export default function TicketNewPage() {
  return (
    <AdminGate permission="tickets:create">
      <NewTicketForm />
    </AdminGate>
  );
}
