"use client";

import { useState } from "react";
import { INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import {
  AFTER_HOURS_HANDLINGS,
  AFTER_HOURS_HANDLING_LABEL,
  describeHandling,
  formatMultiplier,
} from "@/lib/time/after-hours";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  useListAccountContractsQuery,
  usePatchContractMutation,
  type AfterHoursHandling,
  type Contract,
} from "@/redux/ticketsApi";

const MODEL_LABEL: Record<string, string> = {
  retainer: "Retainer",
  prepaid_block: "Prepaid block",
  time_and_materials: "Time and materials",
  fixed_fee: "Fixed fee",
};

function ContractStatusPill({ status }: { status: string }) {
  const tone = status === "active" ? "complete" : status === "draft" ? "needs-input" : "blocked";
  return <SignalPill tone={tone} label={status.charAt(0).toUpperCase() + status.slice(1)} />;
}

/** "Premium 1.5x per contract", "Comp time" or "None" for the list cell. */
export function handlingCell(contract: Contract): string {
  return describeHandling(contract) ?? AFTER_HOURS_HANDLING_LABEL[contract.after_hours_handling];
}

/** Why the draft cannot be sent yet, in the screen's words; null when it can. */
export function validateHandling(handling: AfterHoursHandling, multiplier: string): string | null {
  if (handling !== "premium_rate") return null;
  const value = Number(multiplier);
  if (multiplier.trim() === "" || !Number.isFinite(value)) return "Premium rate needs a multiplier, for example 1.5.";
  if (value < 1) return "The multiplier must be 1 or more.";
  return null;
}

function describeContractError(error: unknown): string {
  const parsed = apiError(error);
  if (parsed.code === "multiplier_required") return "Premium rate needs a multiplier, for example 1.5.";
  if (parsed.code === "stale_version") return "Someone else changed this contract. It has been reloaded.";
  if (parsed.code === "not_found") return "This contract is not on this account any more.";
  return describeError(parsed);
}

/**
 * The inline editor for one contract's after-hours handling (TB-13): None,
 * Premium rate with its multiplier, or Comp time, saved through PATCH with
 * the version the screen holds. multiplier_required and a stale version
 * come back in the screen's words; the stale one also reloads the list.
 */
function HandlingEditor({
  accountId,
  contract,
  onDone,
  refetch,
}: {
  accountId: string;
  contract: Contract;
  onDone: () => void;
  refetch: () => unknown;
}) {
  const [handling, setHandling] = useState<AfterHoursHandling>(contract.after_hours_handling);
  const [multiplier, setMultiplier] = useState(
    contract.after_hours_multiplier ? String(Number(contract.after_hours_multiplier)) : "1.5",
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [patch, patchState] = usePatchContractMutation();
  const { push } = useToast();
  const track = useTrack("contract.after_hours.save");

  const onSave = async () => {
    const invalid = validateHandling(handling, multiplier);
    setProblem(invalid);
    if (invalid) return;
    try {
      const saved = await patch({
        accountId,
        contractId: contract.id,
        body: {
          version: contract.version,
          after_hours_handling: handling,
          ...(handling === "premium_rate" ? { after_hours_multiplier: Number(multiplier) } : {}),
        },
      }).unwrap();
      track({ account_id: accountId, contract_id: contract.id, handling, version: saved.version });
      push({
        title: "After-hours handling saved",
        detail: `${contract.key}: ${handlingCell(saved)}.`,
        tone: "success",
      });
      onDone();
    } catch (caught) {
      setProblem(describeContractError(caught));
      if (apiError(caught).code === "stale_version") refetch();
    }
  };

  return (
    <Panel title={`After-hours handling for ${contract.key}`} caption={`${contract.name}, version ${contract.version}`}>
      <div className="flex flex-col gap-3 text-[12px]" data-handling-editor={contract.id}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Handling</span>
            <select
              aria-label="After-hours handling"
              className={cn(INPUT, "w-[200px]")}
              value={handling}
              onChange={(event) => setHandling(event.target.value as AfterHoursHandling)}
            >
              {AFTER_HOURS_HANDLINGS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {handling === "premium_rate" ? (
            <label className="flex flex-col gap-1">
              <span className="text-xms-label">Multiplier</span>
              <input
                aria-label="Multiplier"
                inputMode="decimal"
                className={cn(INPUT, "xms-mono w-[110px]")}
                value={multiplier}
                onChange={(event) => setMultiplier(event.target.value)}
              />
            </label>
          ) : null}
        </div>
        <p className="text-xms-label">
          {handling === "premium_rate"
            ? "After-hours, weekend and holiday entries carry this multiplier when logged."
            : handling === "comp_time"
              ? "Non-standard entries are counted for comp time on the account's comp-time report."
              : "Non-standard entries are badged but carry no premium and no comp time."}
        </p>
        <InlineError message={problem} />
        <div className="flex items-center gap-2">
          <button type="button" className={PRIMARY_BUTTON} onClick={onSave} disabled={patchState.isLoading}>
            Save handling
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={onDone} disabled={patchState.isLoading}>
            Cancel
          </button>
        </div>
      </div>
    </Panel>
  );
}

/**
 * The account record's Contracts tab: the account's contracts (key, name,
 * model, status, after-hours handling) under tickets:view, with an inline
 * edit of the handling under contracts:manage. The API decides either way.
 */
export function AccountContractsTab({ accountId }: { accountId: string }) {
  const me = useMe();
  const canRead = me.hasPermission("tickets:view");
  const canEdit = me.hasPermission("contracts:manage");
  const contracts = useListAccountContractsQuery(accountId, { skip: !canRead });
  const [editing, setEditing] = useState<string | null>(null);
  const rows = contracts.data ?? [];
  const current = rows.find((row) => row.id === editing) ?? null;

  if (!canRead) {
    return (
      <Panel title="Contracts" caption="Needs the tickets:view permission">
        <p className="text-xms-label text-[13px]">You can see this account but not its contracts.</p>
      </Panel>
    );
  }

  const columns: DenseColumn<Contract>[] = [
    { key: "key", title: "Key", mono: true, sortValue: (row) => row.key },
    { key: "name", title: "Name", sortValue: (row) => row.name },
    {
      key: "model",
      title: "Model",
      sortValue: (row) => row.model,
      render: (row) => MODEL_LABEL[row.model] ?? row.model,
    },
    {
      key: "status",
      title: "Status",
      sortValue: (row) => row.status,
      render: (row) => <ContractStatusPill status={row.status} />,
    },
    {
      key: "after_hours",
      title: "After hours",
      sortValue: (row) => row.after_hours_handling,
      render: (row) => (
        <span data-handling={row.after_hours_handling}>
          {handlingCell(row)}
          {row.after_hours_handling === "premium_rate" && row.after_hours_multiplier ? (
            <span className="xms-mono text-xms-label ml-2 text-[11px]">
              {formatMultiplier(row.after_hours_multiplier)}
            </span>
          ) : null}
        </span>
      ),
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            title: "",
            render: (row: Contract) => (
              <button
                type="button"
                className={cn(SECONDARY_BUTTON, "h-[26px] px-2 text-[12px]")}
                onClick={() => setEditing(row.id)}
                aria-label={`Edit handling for ${row.key}`}
              >
                Edit handling
              </button>
            ),
          } satisfies DenseColumn<Contract>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <DenseTable
        title="Contracts"
        count={rows.length}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={contracts.isLoading}
        emptyState="No contracts on this account yet."
      />
      {current && canEdit ? (
        <HandlingEditor
          key={`${current.id}:${current.version}`}
          accountId={accountId}
          contract={current}
          onDone={() => setEditing(null)}
          refetch={contracts.refetch}
        />
      ) : null}
    </div>
  );
}
