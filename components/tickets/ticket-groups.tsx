"use client";

import { useState } from "react";
import { formatDate, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { FilterSelect } from "@/components/xms/filter-select";
import { ICON, PlusIcon } from "@/components/xms/icons";
import { Panel } from "@/components/xms/panel";
import { SignalPill, type SignalTone } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import {
  describeTicketGroupError,
  ticketGroupKindLabel,
  ticketGroupStatusLabel,
  toFreezeDrafts,
  toFreezeWindows,
  toInstant,
  toLocalInput,
  scheduleMoved,
  validateTicketGroup,
  type FreezeDraft,
  type TicketGroupDraft,
} from "@/lib/tickets/groups";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  TICKET_GROUP_KINDS,
  TICKET_GROUP_STATUSES,
  useCreateTicketGroupMutation,
  useListGrantedAccountsQuery,
  useListTicketGroupsQuery,
  usePatchTicketGroupMutation,
  type TicketGroup,
  type TicketGroupKind,
  type TicketGroupStatus,
} from "@/redux/ticketsApi";

/** The status ramp: a planned window is waiting, an active one is running, a cancelled one is off. */
const STATUS_TONE: Record<TicketGroupStatus, SignalTone> = {
  planned: "needs-input",
  active: "ready",
  closed: "complete",
  cancelled: "blocked",
};

/** "1 Oct 2026 18:00 to 2 Oct 2026 02:00", or the reason there is no span. */
export function scheduleLabel(group: Pick<TicketGroup, "starts_at" | "ends_at">): string {
  if (!group.starts_at && !group.ends_at) return "No dates";
  if (!group.starts_at) return `Until ${formatDate(group.ends_at)}`;
  if (!group.ends_at) return `From ${formatDate(group.starts_at)}`;
  return `${formatDate(group.starts_at)} to ${formatDate(group.ends_at)}`;
}

function emptyDraft(accountId: string): TicketGroupDraft {
  return {
    accountId,
    kind: "change_window",
    name: "",
    description: "",
    ownerUserId: "",
    status: "planned",
    startsAt: "",
    endsAt: "",
    freezes: [],
    changeWindowReason: "",
  };
}

function toDraft(group: TicketGroup): TicketGroupDraft {
  return {
    accountId: group.account_id,
    kind: group.kind,
    name: group.name,
    description: group.description,
    ownerUserId: group.owner_user_id ?? "",
    status: group.status,
    startsAt: toLocalInput(group.starts_at),
    endsAt: toLocalInput(group.ends_at),
    freezes: toFreezeDrafts(group.freeze_windows),
    changeWindowReason: "",
  };
}

/**
 * The freezes on one window (TM-18): the spans during which nothing may be
 * scheduled, with the reason each is there. The API stores them on the
 * window, so the whole set travels with every save and a removed row is
 * removed by being absent.
 */
function FreezeRows({ freezes, onChange }: { freezes: FreezeDraft[]; onChange: (freezes: FreezeDraft[]) => void }) {
  const edit = (index: number, change: Partial<FreezeDraft>) =>
    onChange(freezes.map((freeze, order) => (order === index ? { ...freeze, ...change } : freeze)));
  return (
    <div className="flex flex-col gap-2" data-freezes>
      <span className="text-xms-label">Freezes</span>
      {freezes.map((freeze, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <input
            aria-label={`Freeze ${index + 1} starts`}
            type="datetime-local"
            value={freeze.startsAt}
            onChange={(event) => edit(index, { startsAt: event.target.value })}
            className={cn(INPUT, "xms-mono w-[200px]")}
          />
          <input
            aria-label={`Freeze ${index + 1} ends`}
            type="datetime-local"
            value={freeze.endsAt}
            onChange={(event) => edit(index, { endsAt: event.target.value })}
            className={cn(INPUT, "xms-mono w-[200px]")}
          />
          <input
            aria-label={`Freeze ${index + 1} reason`}
            value={freeze.reason}
            placeholder="Why nothing may go out"
            onChange={(event) => edit(index, { reason: event.target.value })}
            className={cn(INPUT, "w-[240px]")}
          />
          <button
            type="button"
            onClick={() => onChange(freezes.filter((_, order) => order !== index))}
            className="text-xms-accent pb-2 text-[12px] hover:underline"
          >
            Remove freeze
          </button>
        </div>
      ))}
      {freezes.length === 0 ? (
        <p className="text-xms-label">No freezes. Anything inside the window may be scheduled.</p>
      ) : null}
      <div>
        <button
          type="button"
          onClick={() => onChange([...freezes, { startsAt: "", endsAt: "", reason: "" }])}
          className={SECONDARY_BUTTON}
        >
          Add freeze
        </button>
      </div>
    </div>
  );
}

/**
 * The form for one group. Creating names the account and the kind, which the
 * API does not let a PATCH move: a project that becomes a change window
 * would carry a schedule nothing had ever checked, so it is a new record.
 */
function GroupForm({
  draft,
  setDraft,
  accounts,
  editing,
  problems,
  pending,
  onSubmit,
  onCancel,
  editingRow,
}: {
  draft: TicketGroupDraft;
  setDraft: (draft: TicketGroupDraft) => void;
  accounts: { id: string; name: string }[];
  editing: boolean;
  problems: string[];
  pending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  /** The row being edited, so a moved schedule can be told from a rename. */
  editingRow?: TicketGroup;
}) {
  const scheduleChanged =
    Boolean(editingRow) &&
    draft.kind === "change_window" &&
    scheduleMoved(editingRow!, {
      startsAt: toInstant(draft.startsAt),
      endsAt: toInstant(draft.endsAt),
      freezes: toFreezeWindows(draft.freezes),
    });
  return (
    <form
      aria-label={editing ? "Edit group" : "New group"}
      className="flex flex-col gap-3 text-[12px]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Name</span>
          <input
            aria-label="Name"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className={cn(INPUT, "w-[260px]")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Kind</span>
          <select
            aria-label="Kind"
            value={draft.kind}
            disabled={editing}
            onChange={(event) => setDraft({ ...draft, kind: event.target.value as TicketGroupKind })}
            className={cn(INPUT, "w-[180px]")}
          >
            {TICKET_GROUP_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {ticketGroupKindLabel(kind)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Account</span>
          <select
            aria-label="Account"
            value={draft.accountId}
            disabled={editing}
            onChange={(event) => setDraft({ ...draft, accountId: event.target.value })}
            className={cn(INPUT, "w-[220px]")}
          >
            <option value="">Choose</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Status</span>
          <select
            aria-label="Status"
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value as TicketGroupStatus })}
            className={cn(INPUT, "w-[160px]")}
          >
            {TICKET_GROUP_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ticketGroupStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Starts</span>
          <input
            aria-label="Starts"
            type="datetime-local"
            value={draft.startsAt}
            onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
            className={cn(INPUT, "xms-mono w-[220px]")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Ends</span>
          <input
            aria-label="Ends"
            type="datetime-local"
            value={draft.endsAt}
            onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
            className={cn(INPUT, "xms-mono w-[220px]")}
          />
        </label>
        <p className="text-xms-label pb-2">
          A change window needs both ends. The times are read in this browser&apos;s zone and sent as instants.
        </p>
      </div>
      <FreezeRows freezes={draft.freezes} onChange={(freezes) => setDraft({ ...draft, freezes })} />
      {scheduleChanged ? (
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Why the schedule moved</span>
          <input
            aria-label="Why the schedule moved"
            value={draft.changeWindowReason}
            onChange={(event) => setDraft({ ...draft, changeWindowReason: event.target.value })}
            placeholder="Recorded on the audit trail beside the change"
            maxLength={1000}
            className={INPUT}
          />
          <span className="text-xms-label">
            Moving a change window moves what the deploy gate allows, so the reason is kept with the change.
          </span>
        </label>
      ) : null}
      <label className="flex flex-col gap-1">
        <span className="text-xms-label">Description</span>
        <input
          aria-label="Description"
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          placeholder="What this window or project covers"
          className={INPUT}
        />
      </label>
      {problems.length > 0 ? (
        <ul className="text-[12px] text-[color:var(--state-overdue-text)]">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {editing ? "Save group" : "Create group"}
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * The groups catalog (TM-10): projects and change windows across the
 * accounts granted to this reader, with the schedule each one carries.
 * Reading is `tickets:view`, the screen's own gate; creating and editing are
 * `tickets:work`, so a reader without it sees the list and no form.
 */
export function TicketGroupsCatalog() {
  const me = useMe();
  const canWrite = me.hasPermission("tickets:work");
  const { data: accounts } = useListGrantedAccountsQuery();
  const [kind, setKind] = useState<TicketGroupKind | "">("");
  const [status, setStatus] = useState<TicketGroupStatus | "">("");
  const [accountId, setAccountId] = useState("");
  const { data, isLoading } = useListTicketGroupsQuery({
    account_id: accountId || undefined,
    kind: kind || undefined,
    status: status || undefined,
  });
  const [create, creating] = useCreateTicketGroupMutation();
  const [patch, patching] = usePatchTicketGroupMutation();
  const { push } = useToast();
  const [editing, setEditing] = useState<TicketGroup | null>(null);
  const [draft, setDraft] = useState<TicketGroupDraft | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const accountName = (id: string) => accounts?.find((account) => account.id === id)?.name ?? id;
  const rows = data ?? [];

  const openNew = () => {
    setEditing(null);
    setProblems([]);
    setDraft(emptyDraft(accountId || (accounts?.length === 1 ? accounts[0].id : "")));
  };

  const openEdit = (group: TicketGroup) => {
    setEditing(group);
    setProblems([]);
    setDraft(toDraft(group));
  };

  const submit = async () => {
    if (!draft) return;
    const found = validateTicketGroup(draft, editing ?? undefined);
    setProblems(found);
    if (found.length > 0) return;
    try {
      if (editing) {
        const startsAt = toInstant(draft.startsAt);
        const endsAt = toInstant(draft.endsAt);
        const freezes = toFreezeWindows(draft.freezes);
        const moved = scheduleMoved(editing, { startsAt, endsAt, freezes });
        await patch({
          id: editing.id,
          body: {
            version: editing.version,
            name: draft.name.trim(),
            description: draft.description.trim(),
            status: draft.status,
            // Sent only where they moved, so a rename does not read as a
            // schedule change and ask for a reason that has nothing to say.
            ...(moved
              ? {
                  starts_at: startsAt,
                  ends_at: endsAt,
                  freeze_windows: freezes,
                  ...(draft.kind === "change_window" ? { change_window_reason: draft.changeWindowReason.trim() } : {}),
                }
              : {}),
          },
        }).unwrap();
        push({ title: `${draft.name.trim()} saved`, tone: "success" });
      } else {
        await create({
          account_id: draft.accountId,
          kind: draft.kind,
          name: draft.name.trim(),
          description: draft.description.trim() || undefined,
          status: draft.status,
          starts_at: toInstant(draft.startsAt),
          ends_at: toInstant(draft.endsAt),
          freeze_windows: toFreezeWindows(draft.freezes),
        }).unwrap();
        push({ title: `${draft.name.trim()} created`, tone: "success" });
      }
      setDraft(null);
      setEditing(null);
    } catch (error) {
      push({ title: "The group was not saved", detail: describeTicketGroupError(error), tone: "error" });
    }
  };

  const columns: DenseColumn<TicketGroup>[] = [
    {
      key: "name",
      title: "Name",
      sortValue: (row) => row.name,
      render: (row) => <span className="text-xms-ink font-medium">{row.name}</span>,
    },
    { key: "kind", title: "Kind", sortValue: (row) => row.kind, render: (row) => ticketGroupKindLabel(row.kind) },
    {
      key: "account",
      title: "Account",
      sortValue: (row) => row.account_id,
      render: (row) => accountName(row.account_id),
    },
    {
      key: "schedule",
      title: "Schedule",
      mono: true,
      sortValue: (row) => row.starts_at ?? "",
      render: (row) => scheduleLabel(row),
    },
    {
      key: "freezes",
      title: "Freezes",
      align: "right",
      sortValue: (row) => (row.freeze_windows ?? []).length,
      render: (row) => (row.freeze_windows ?? []).length || "",
    },
    {
      key: "status",
      title: "Status",
      sortValue: (row) => row.status,
      render: (row) => (
        <SignalPill tone={STATUS_TONE[row.status] ?? "needs-input"} label={ticketGroupStatusLabel(row.status)} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* The dimensions stand on the grey strip, as they do on every other
          list screen, rather than in a "Filters" card of their own holding
          three native selects and the primary action beside them. */}
      <HeaderFilters>
        <FilterSelect
          label="Account"
          value={accountId}
          options={(accounts ?? []).map((account) => ({ value: account.id, label: account.name }))}
          onChange={setAccountId}
        />
        <FilterSelect
          label="Kind"
          value={kind}
          options={TICKET_GROUP_KINDS.map((entry) => ({ value: entry, label: ticketGroupKindLabel(entry) }))}
          onChange={(value) => setKind(value as TicketGroupKind | "")}
        />
        <FilterSelect
          label="Status"
          value={status}
          options={TICKET_GROUP_STATUSES.map((entry) => ({ value: entry, label: ticketGroupStatusLabel(entry) }))}
          onChange={(value) => setStatus(value as TicketGroupStatus | "")}
        />
      </HeaderFilters>
      {canWrite ? (
        <HeaderAction>
          <button type="button" onClick={openNew} className={cn(PRIMARY_BUTTON, "inline-flex items-center gap-1")}>
            <PlusIcon size={ICON.action} />
            New
          </button>
        </HeaderAction>
      ) : null}

      {draft ? (
        <Panel title={editing ? `Edit ${editing.name}` : "New group"} caption="GROUP">
          <GroupForm
            draft={draft}
            setDraft={setDraft}
            accounts={accounts ?? []}
            editing={editing !== null}
            editingRow={editing ?? undefined}
            problems={problems}
            pending={creating.isLoading || patching.isLoading}
            onSubmit={() => void submit()}
            onCancel={() => {
              setDraft(null);
              setEditing(null);
            }}
          />
        </Panel>
      ) : null}

      {isLoading && !data ? (
        <Skeleton lines={6} />
      ) : (
        <DenseTable<TicketGroup>
          // The card was titled "Count", which is the word the Queue's own
          // header lost in pass two. It is named for what it holds, with the
          // sentence that explains the screen beside it.
          title="Groups"
          subtitle="projects and change windows across the accounts granted to you"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          defaultSort={{ key: "schedule", direction: "desc" }}
          onRowClick={canWrite ? openEdit : undefined}
          // A line where the rows would be, not a card inside the card.
          emptyState={
            canWrite
              ? "No groups here. Create a change window to schedule changes against it."
              : "No groups here. A change window is created by someone holding tickets:work."
          }
        />
      )}
    </div>
  );
}
