"use client";

import { useMemo, useState } from "react";
import { FieldRow, INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { useToast } from "@/components/xms/toast";
import {
  alertsLabel,
  describeEngagementError,
  draftFromEngagement,
  emptyEngagementDraft,
  engagementBody,
  engagementError,
  ENGAGEMENT_STATUS,
  ENGAGEMENT_STATUSES,
  MAX_NOTICE_DAYS,
  noticeDeadline,
  noticeLabel,
  ownerLabel,
  patchEngagementBody,
  renewalLabel,
  validateEngagement,
  type EngagementDraft,
} from "@/lib/contracts/engagements";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import { useListUsersQuery } from "@/redux/adminApi";
import { useMe } from "@/redux/me";
import {
  useCreateEngagementMutation,
  useListEngagementsQuery,
  usePatchEngagementMutation,
  type Engagement,
  type EngagementStatus,
} from "@/redux/ticketsApi";

const SMALL = "h-[26px] px-2 text-[12px]";

export function EngagementStatusPill({ status }: { status: EngagementStatus }) {
  const { label, tone } = ENGAGEMENT_STATUS[status];
  return <SignalPill tone={tone} label={label} />;
}

/** The internal directory as id to display name, empty where admin:users is not held. */
export function useOwnerNames(): Record<string, string> {
  const me = useMe();
  const users = useListUsersQuery({ kind: "internal" }, { skip: !me.hasPermission("admin:users") });
  return useMemo(() => {
    const names: Record<string, string> = {};
    for (const user of users.data ?? []) {
      const full = `${user.first_name} ${user.last_name}`.trim();
      names[user.id] = full === "" ? user.email : full;
    }
    return names;
  }, [users.data]);
}

/**
 * The add and edit form. One form serves both: a create takes the status the
 * renewal date implies, so the status control appears only on an edit, where
 * a person may overrule it.
 */
export function EngagementForm({
  title,
  draft,
  onChange,
  onSubmit,
  onCancel,
  saving,
  error,
  owners,
  editing,
}: {
  title: string;
  draft: EngagementDraft;
  onChange: (next: EngagementDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  owners: Record<string, string>;
  editing: boolean;
}) {
  const set = (patch: Partial<EngagementDraft>) => onChange({ ...draft, ...patch });
  const ownerIds = Object.keys(owners).sort((a, b) => owners[a].localeCompare(owners[b]));
  return (
    <Panel title={title} caption="Engagement" subtitle="The commercial envelope its contracts are filed under.">
      <form
        className="flex flex-col gap-3"
        aria-label={title}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <FieldRow label="Name" htmlFor="engagement-name">
          <input
            id="engagement-name"
            maxLength={160}
            className={INPUT}
            value={draft.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        </FieldRow>
        <FieldRow label="Owner" htmlFor="engagement-owner">
          {ownerIds.length > 0 ? (
            <select
              id="engagement-owner"
              className={INPUT}
              value={draft.ownerUserId}
              onChange={(event) => set({ ownerUserId: event.target.value })}
            >
              <option value="">No owner</option>
              {ownerIds.map((id) => (
                <option key={id} value={id}>
                  {owners[id]}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="engagement-owner"
              className={cn(INPUT, "xms-mono")}
              placeholder="User id"
              value={draft.ownerUserId}
              onChange={(event) => set({ ownerUserId: event.target.value })}
            />
          )}
        </FieldRow>
        <FieldRow label="Renewal date" htmlFor="engagement-renewal">
          <input
            id="engagement-renewal"
            type="date"
            className={cn(INPUT, "xms-mono")}
            value={draft.renewalDate}
            onChange={(event) => set({ renewalDate: event.target.value })}
          />
        </FieldRow>
        <FieldRow label="Notice period (days)" htmlFor="engagement-notice">
          <input
            id="engagement-notice"
            inputMode="numeric"
            max={MAX_NOTICE_DAYS}
            className={cn(INPUT, "xms-mono w-[110px]")}
            value={draft.noticePeriodDays}
            onChange={(event) => set({ noticePeriodDays: event.target.value })}
          />
        </FieldRow>
        <p className="text-xms-label text-[12px]">
          The renewal alerts go out 90, 60 and 30 days ahead, and again at the notice-period boundary. Moving the
          renewal date clears the ledger, so the new date earns its own alerts.
        </p>
        {editing ? (
          <>
            <FieldRow label="Status" htmlFor="engagement-status">
              <select
                id="engagement-status"
                className={INPUT}
                value={draft.status}
                onChange={(event) => set({ status: event.target.value as EngagementStatus })}
              >
                {ENGAGEMENT_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FieldRow>
            <p className="text-xms-label text-[12px]">
              Leave the status alone and a moved renewal date sets it; change it here and your choice stands.
            </p>
          </>
        ) : null}
        <InlineError message={error} />
        <div className="flex items-center gap-2">
          <button type="submit" className={PRIMARY_BUTTON} disabled={saving}>
            {editing ? "Save engagement" : "Add engagement"}
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}

/**
 * Engagements on the account record (Time, Contracts & Budget technical 2.1,
 * functional 5.6): the name, the owner, the renewal date, the notice period,
 * the status the server decided and which renewal alerts it has already
 * fired. Reading needs contracts:view, the permission the API puts on
 * /v1/accounts/:id/engagements, and the panel never asks without it; adding
 * and editing need contracts:manage. The API decides either way.
 */
export function EngagementsPanel({ accountId }: { accountId: string }) {
  const me = useMe();
  const canRead = me.hasPermission("contracts:view");
  const canWrite = me.hasPermission("contracts:manage");
  const engagements = useListEngagementsQuery(accountId, { skip: !canRead });
  const owners = useOwnerNames();
  const [create, creating] = useCreateEngagementMutation();
  const [patch, patching] = usePatchEngagementMutation();
  const { push } = useToast();
  const trackCreate = useTrack("engagement.create");
  const trackPatch = useTrack("engagement.save");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<EngagementDraft>(emptyEngagementDraft);
  const [error, setError] = useState<string | null>(null);

  if (!canRead) {
    return (
      <Panel title="Engagements" caption="Needs the contracts:view permission">
        <p className="text-xms-label text-[13px]">You can see this account but not its engagements.</p>
      </Panel>
    );
  }

  const rows = engagements.data ?? [];
  const current = rows.find((row) => row.id === editing) ?? null;

  const openAdd = () => {
    setEditing(null);
    setError(null);
    setDraft(emptyEngagementDraft);
    setAdding(true);
  };

  const openEdit = (engagement: Engagement) => {
    setAdding(false);
    setError(null);
    setDraft(draftFromEngagement(engagement));
    setEditing(engagement.id);
  };

  const close = () => {
    setAdding(false);
    setEditing(null);
    setError(null);
  };

  const submit = async () => {
    const problem = validateEngagement(draft);
    setError(problem);
    if (problem) return;
    try {
      if (current) {
        const saved = await patch({
          accountId,
          engagementId: current.id,
          body: patchEngagementBody(current, draft),
        }).unwrap();
        trackPatch({ account_id: accountId, engagement_id: saved.id, status: saved.status, version: saved.version });
        push({
          title: "Engagement saved",
          detail: `${saved.name}: ${renewalLabel(saved.renewal_date)}.`,
          tone: "success",
        });
      } else {
        const saved = await create({ accountId, body: engagementBody(draft) }).unwrap();
        trackCreate({ account_id: accountId, engagement_id: saved.id, status: saved.status });
        push({
          title: "Engagement added",
          detail: `${saved.name}: ${renewalLabel(saved.renewal_date)}.`,
          tone: "success",
        });
      }
      close();
    } catch (caught) {
      const parsed = engagementError(caught);
      setError(describeEngagementError(parsed));
      // The slice reloads the list on a refused patch, so a stale version
      // shows the row as it now stands; the form closes onto it.
      if (parsed.code === "stale_version" || parsed.code === "not_found") setEditing(null);
    }
  };

  const columns: DenseColumn<Engagement>[] = [
    { key: "name", title: "Name", sortValue: (row) => row.name },
    {
      key: "owner",
      title: "Owner",
      sortValue: (row) => ownerLabel(row.owner_user_id, owners),
      render: (row) => (
        <span className={cn(row.owner_user_id && !owners[row.owner_user_id] ? "xms-mono text-[12px]" : undefined)}>
          {ownerLabel(row.owner_user_id, owners)}
        </span>
      ),
    },
    {
      key: "renewal",
      title: "Renewal date",
      mono: true,
      sortValue: (row) => row.renewal_date ?? "",
      render: (row) => renewalLabel(row.renewal_date),
    },
    {
      key: "notice",
      title: "Notice period",
      sortValue: (row) => row.notice_period_days ?? -1,
      render: (row) => {
        const deadline = noticeDeadline(row);
        return (
          <span className="text-xms-body text-[12px]" data-notice={row.id}>
            {noticeLabel(row.notice_period_days)}
            {deadline ? <span className="xms-mono text-xms-label ml-2 text-[11px]">decide by {deadline}</span> : null}
          </span>
        );
      },
    },
    {
      key: "status",
      title: "Status",
      sortValue: (row) => row.status,
      render: (row) => <EngagementStatusPill status={row.status} />,
    },
    {
      key: "alerts",
      title: "Alerts fired",
      sortValue: (row) => row.renewal_alerts_fired.length,
      render: (row) => (
        <span className="text-xms-body text-[12px]" data-alerts={row.id}>
          {alertsLabel(row.renewal_alerts_fired)}
        </span>
      ),
    },
    ...(canWrite
      ? [
          {
            key: "actions",
            title: "",
            render: (row: Engagement) => (
              <button
                type="button"
                className={cn(SECONDARY_BUTTON, SMALL)}
                onClick={() => openEdit(row)}
                aria-label={`Edit ${row.name}`}
              >
                Edit
              </button>
            ),
          } satisfies DenseColumn<Engagement>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="engagements">
      <DenseTable
        title="Engagements"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={engagements.isLoading}
        emptyState="No engagement on this account yet."
        footer={
          canWrite && !adding && !current ? (
            <div className="border-xms-line border-t px-4 py-3">
              <button type="button" className={cn(PRIMARY_BUTTON, SMALL)} onClick={openAdd}>
                New engagement
              </button>
            </div>
          ) : null
        }
      />
      {canWrite && (adding || current) ? (
        <EngagementForm
          key={current ? `${current.id}:${current.version}` : "new"}
          title={current ? `Edit ${current.name}` : "New engagement"}
          draft={draft}
          onChange={setDraft}
          onSubmit={() => void submit()}
          onCancel={close}
          saving={creating.isLoading || patching.isLoading}
          error={error}
          owners={owners}
          editing={Boolean(current)}
        />
      ) : null}
    </div>
  );
}
