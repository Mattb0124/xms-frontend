"use client";

import { useState } from "react";
import {
  FieldRow,
  INPUT,
  InlineError,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SwitchRow,
} from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { describeMigrationError, migrationError } from "@/lib/migration/errors";
import { OBJECT_KINDS, SOURCE_KINDS } from "@/lib/migration/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { useListConnectorsQuery } from "@/redux/connectorsApi";
import { useMe } from "@/redux/me";
import { useCreateBatchMutation, type CreateBatchBody, type MigrationBatch } from "@/redux/migrationApi";

export interface NewBatchFormProps {
  /** Accounts the person may choose from (the granted list, or the admin list). */
  accounts: { id: string; name: string }[];
  /** Prefill from a "Run again" link: account, instance, range and the batch this one supersedes. */
  initial?: Partial<CreateBatchBody>;
  onCreated: (batch: MigrationBatch) => void;
  onCancel?: () => void;
}

/**
 * "New batch" (Data Migration functional 5.2): account, object kind, source
 * kind, the source instance from the account's connectors, the range and
 * the dry-run toggle (on by default; a rehearsal never loads). The server
 * validates the range, checks the instance is on the account and refuses
 * an instance without an active field map; those answers are shown inline.
 */
export function NewBatchForm({ accounts, initial, onCreated, onCancel }: NewBatchFormProps) {
  const me = useMe();
  const canPickInstance = me.hasPermission("admin:connectors");
  const [create, { isLoading }] = useCreateBatchMutation();
  const track = useTrack("migration.batch.create");
  const [form, setForm] = useState({
    account_id: initial?.account_id ?? (accounts.length === 1 ? accounts[0].id : ""),
    object_kind: initial?.object_kind ?? "case",
    source_kind: "servicenow_table_api",
    instance_id: initial?.instance_id ?? "",
    opened_from: initial?.opened_from ?? "",
    opened_to: initial?.opened_to ?? "",
    dry_run: initial?.dry_run ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const instances = useListConnectorsQuery(form.account_id, { skip: !form.account_id || !canPickInstance });
  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const rangeProblem =
    form.opened_from && form.opened_to && form.opened_to < form.opened_from
      ? "The end of the range is before its start."
      : null;

  return (
    <Panel
      title="New batch"
      caption={
        initial?.supersedes_batch_id
          ? "Runs the same scope again and supersedes the earlier batch"
          : "One object kind for one account"
      }
    >
      <form
        className="flex flex-col gap-3"
        aria-label="New batch"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          if (rangeProblem) {
            setError(rangeProblem);
            return;
          }
          const body: CreateBatchBody = {
            account_id: form.account_id,
            instance_id: form.instance_id.trim(),
            object_kind: "case",
            opened_from: form.opened_from,
            opened_to: form.opened_to,
            dry_run: form.dry_run,
          };
          if (initial?.supersedes_batch_id) body.supersedes_batch_id = initial.supersedes_batch_id;
          try {
            const created = await create(body).unwrap();
            track({ account_id: body.account_id, batch_id: created.id, dry_run: body.dry_run ?? true });
            onCreated(created);
          } catch (caught) {
            setError(describeMigrationError(migrationError(caught)));
          }
        }}
      >
        <FieldRow label="Account" htmlFor="batch-account">
          <select
            id="batch-account"
            required
            className={INPUT}
            value={form.account_id}
            onChange={(event) => {
              set("account_id", event.target.value);
              set("instance_id", "");
            }}
          >
            <option value="">Choose an account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Object kind" htmlFor="batch-kind">
          <select
            id="batch-kind"
            className={INPUT}
            value={form.object_kind}
            onChange={(event) => set("object_kind", event.target.value)}
          >
            {OBJECT_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value} disabled={!kind.available}>
                {kind.label}
                {kind.available ? "" : " (Phase 3)"}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Source" htmlFor="batch-source">
          <select
            id="batch-source"
            className={INPUT}
            value={form.source_kind}
            onChange={(event) => set("source_kind", event.target.value)}
          >
            {SOURCE_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value} disabled={!kind.available}>
                {kind.label}
                {kind.available ? "" : " (Phase 3)"}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Instance" htmlFor="batch-instance">
          {canPickInstance ? (
            <select
              id="batch-instance"
              required
              className={INPUT}
              value={form.instance_id}
              disabled={!form.account_id}
              onChange={(event) => set("instance_id", event.target.value)}
            >
              <option value="">
                {!form.account_id
                  ? "Choose the account first"
                  : instances.isLoading
                    ? "Loading instances"
                    : (instances.data ?? []).length === 0
                      ? "No connector on this account"
                      : "Choose an instance"}
              </option>
              {(instances.data ?? []).map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.name} ({instance.table_name}){instance.active_field_map_id ? "" : ", no active field map"}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex flex-col gap-1">
              <input
                id="batch-instance"
                required
                className={INPUT}
                placeholder="Connector instance id"
                value={form.instance_id}
                onChange={(event) => set("instance_id", event.target.value)}
              />
              <span className="text-xms-label text-[12px]">
                Listing the account&apos;s instances needs admin:connectors.
              </span>
            </div>
          )}
        </FieldRow>
        <FieldRow label="Opened from" htmlFor="batch-from">
          <input
            id="batch-from"
            type="date"
            required
            className={INPUT}
            value={form.opened_from}
            onChange={(event) => set("opened_from", event.target.value)}
          />
        </FieldRow>
        <FieldRow label="Opened to" htmlFor="batch-to">
          <input
            id="batch-to"
            type="date"
            required
            className={INPUT}
            value={form.opened_to}
            onChange={(event) => set("opened_to", event.target.value)}
          />
        </FieldRow>
        <SwitchRow
          id="batch-dry-run"
          label="Dry run"
          detail="Extracts, maps and reconciles; loads nothing"
          checked={form.dry_run}
          onChange={(next) => set("dry_run", next)}
        />
        <InlineError message={error ?? rangeProblem} />
        <p className="text-xms-label text-[12px]">
          The batch is created as a draft. Run it from its record; a dry run is safe to repeat.
        </p>
        <div className="flex items-center gap-2">
          <button type="submit" className={PRIMARY_BUTTON} disabled={isLoading || Boolean(rangeProblem)}>
            Create batch
          </button>
          {onCancel ? (
            <button type="button" className={SECONDARY_BUTTON} onClick={onCancel} disabled={isLoading}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}
