"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminGate, INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { HeaderAction } from "@/components/shell/content-header-bar";
import { DropZone } from "@/components/tickets/attachments";
import {
  EMPTY_TICKET_DRAFT,
  NewTicketClassification,
  NewTicketWho,
  type NewTicketDraft,
} from "@/components/tickets/new-ticket-fields";
import { submitNewTicket } from "@/components/tickets/submit-new-ticket";
import { formatBytes } from "@/lib/attachments/upload";
import { Panel } from "@/components/xms/panel";
import { useToast } from "@/components/xms/toast";
import { useTrack } from "@/lib/telemetry/provider";
import { derivePriority } from "@/lib/tickets/priority";
import { useMe } from "@/redux/me";
import {
  useCreateTicketMutation,
  useListAccountContractsQuery,
  useListDirectoryGroupsQuery,
  useListGrantedAccountsQuery,
} from "@/redux/ticketsApi";

/** The full-screen record form (User Experience 3.3): label-left grid, live priority preview, one submit. */
function NewTicketForm() {
  const router = useRouter();
  const me = useMe();
  const { push } = useToast();
  const track = useTrack("ticket.create");
  const { data: accounts } = useListGrantedAccountsQuery();
  const { data: groups } = useListDirectoryGroupsQuery();
  const [draft, setDraft] = useState<NewTicketDraft>(EMPTY_TICKET_DRAFT);
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
  const update = (patch: Partial<NewTicketDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const canSubmit = accountId !== "" && draft.short_description.trim() !== "" && !isLoading && !uploading;

  const submit = () =>
    submitNewTicket({
      accountId,
      contractId,
      draft,
      files,
      create: (body) => create(body).unwrap(),
      track,
      push,
      goTo: (href) => router.push(href),
      setUploading,
      setError,
      setDetails,
      setContractChoices,
    });

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
      {/* The two actions are the screen's, so they stand in the toolbar right,
          which is where Quarantine's own title row went in pass three. */}
      <HeaderAction>
        <Link href="/cases" className={`${SECONDARY_BUTTON} inline-flex items-center`}>
          Cancel
        </Link>
        <button type="submit" form="new-ticket" disabled={!canSubmit} className={PRIMARY_BUTTON}>
          Submit
        </button>
      </HeaderAction>
      {error ? (
        <div className="rounded-card border border-[color:var(--state-overdue-border)] bg-[color:var(--state-overdue-bg)] px-4 py-2">
          <InlineError message={error} />
          {details.map((detail) => (
            <p key={detail} className="text-xms-label text-body">
              {detail}
            </p>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <NewTicketWho
          draft={draft}
          accountId={accountId}
          contractId={contractId}
          activeAccounts={activeAccounts}
          contracts={contractChoices ?? activeContracts}
          canReadContracts={canReadContracts}
          groups={groups}
          currentUserId={me.principal?.userId}
          onChange={update}
        />
        <NewTicketClassification draft={draft} priority={priority} onChange={update} />
      </div>
      <Panel title="Description">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-body">
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
          <label className="flex flex-col gap-1 text-body">
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
                <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-body">
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
