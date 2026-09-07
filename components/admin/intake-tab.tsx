"use client";

import { useState } from "react";
import { ConfirmButton, FieldRow, INPUT, InlineError, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { StatePill } from "@/components/xms/state-pill";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { TICKET_TYPES } from "@/lib/tickets/vocab";
import {
  useCreateAliasMutation,
  useListAliasesQuery,
  useSetAliasStateMutation,
  type AliasState,
  type InboundAlias,
} from "@/redux/emailApi";

/** Alias states on the ramp: active green, disabled by an administrator slate, disabled by the loop guard red. */
export function AliasStatePill({ state, reason }: { state: AliasState; reason?: string | null }) {
  if (state === "disabled_by_loop_guard") {
    return (
      <span
        data-alias-state={state}
        className="inline-flex h-[22px] items-center rounded-[999px] border border-[color:var(--state-overdue-border)] bg-[color:var(--state-overdue-bg)] px-2 text-[12px] text-[color:var(--state-overdue-text)]"
        title={reason ?? undefined}
      >
        Disabled by loop guard{reason ? `: ${reason}` : ""}
      </span>
    );
  }
  if (state === "disabled_by_admin") return <StatePill state="closed" label="Disabled by admin" />;
  return <StatePill state="resolved" label="Active" />;
}

/** The account Intake tab (Email Intake functional 5.3): aliases, their state, add, enable and disable. */
export function IntakeTab({ accountId }: { accountId: string }) {
  const { data, isLoading, refetch } = useListAliasesQuery(accountId);
  const [create, { isLoading: creating }] = useCreateAliasMutation();
  const [setState, { isLoading: switching }] = useSetAliasStateMutation();
  const onError = useMutationErrors(refetch);
  const [form, setForm] = useState({ address: "", kind: "alias" as "alias" | "canonical", default_ticket_type: "" });
  const [error, setError] = useState<string | null>(null);

  const toggle = async (alias: InboundAlias, enable: boolean) => {
    try {
      await setState({ accountId, id: alias.id, enable }).unwrap();
    } catch (caught) {
      onError(caught);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Panel title="Inbound aliases" caption="Addresses that route email to this account">
        {isLoading ? <Skeleton lines={3} /> : null}
        {data && data.length === 0 ? (
          <p className="text-xms-label text-[13px]">No aliases yet. Add the client-facing address below.</p>
        ) : null}
        <ul className="divide-xms-line divide-y" aria-label="Aliases">
          {(data ?? []).map((alias) => (
            <li
              key={alias.id}
              className="flex flex-wrap items-center gap-3 py-2 text-[13px]"
              data-alias={alias.address}
            >
              <span className="xms-mono text-xms-ink">{alias.address}</span>
              <span className="bg-xms-tint text-xms-label rounded-[999px] px-2 py-[1px] text-[11px]">{alias.kind}</span>
              {alias.default_ticket_type ? (
                <span className="text-xms-label text-[12px]">
                  defaults to {alias.default_ticket_type.replace(/_/g, " ")}
                </span>
              ) : null}
              <AliasStatePill state={alias.state} reason={alias.disabled_reason} />
              <span className="ml-auto">
                {alias.state === "active" ? (
                  <ConfirmButton label="Disable" onConfirm={() => toggle(alias, false)} disabled={switching} danger />
                ) : (
                  <ConfirmButton label="Enable" onConfirm={() => toggle(alias, true)} disabled={switching} />
                )}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Add alias" caption="Lowercased and unique across the operator">
        <form
          className="flex flex-col gap-3"
          aria-label="Add alias"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            try {
              await create({
                accountId,
                body: {
                  address: form.address.trim().toLowerCase(),
                  kind: form.kind,
                  default_ticket_type: form.default_ticket_type || undefined,
                },
              }).unwrap();
              setForm({ address: "", kind: "alias", default_ticket_type: "" });
            } catch (caught) {
              setError(describeError(apiError(caught)));
            }
          }}
        >
          <FieldRow label="Address" htmlFor="alias-address">
            <input
              id="alias-address"
              type="email"
              required
              className={INPUT}
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </FieldRow>
          <FieldRow label="Kind" htmlFor="alias-kind">
            <select
              id="alias-kind"
              className={INPUT}
              value={form.kind}
              onChange={(event) => setForm({ ...form, kind: event.target.value as "alias" | "canonical" })}
            >
              <option value="alias">Alias (retained client address)</option>
              <option value="canonical">Canonical (the XMS address)</option>
            </select>
          </FieldRow>
          <FieldRow label="Default type" htmlFor="alias-type">
            <select
              id="alias-type"
              className={INPUT}
              value={form.default_ticket_type}
              onChange={(event) => setForm({ ...form, default_ticket_type: event.target.value })}
            >
              <option value="">Account default</option>
              {TICKET_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </FieldRow>
          <InlineError message={error} />
          <div>
            <button type="submit" className={PRIMARY_BUTTON} disabled={creating}>
              Add alias
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
