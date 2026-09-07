"use client";

import { useState } from "react";
import { RateCardsPanel } from "@/components/admin/contracts/rate-cards";
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
import { describeOverage, describeRollover, OVERAGE_RULES, ROLLOVER_RULES } from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  useListAccountContractsQuery,
  usePatchContractMutation,
  type AfterHoursHandling,
  type Contract,
  type OverageRule,
  type PatchContractBody,
  type RolloverRule,
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

/** "Overage blocked; carries a month; thresholds 50, 75, 90, 100%" for the list cell. */
export function rulesCell(contract: Contract): string {
  const rollover = describeRollover(contract.rollover_rule, contract.rollover_cap_hours);
  const thresholds =
    contract.threshold_percents.length > 0 ? `thresholds ${contract.threshold_percents.join(", ")}%` : "no thresholds";
  return `${describeOverage(contract.overage_rule, contract.overage_multiplier)}; ${rollover.charAt(0).toLowerCase()}${rollover.slice(1)}; ${thresholds}`;
}

/** Why the draft cannot be sent yet, in the screen's words; null when it can. */
export function validateHandling(handling: AfterHoursHandling, multiplier: string): string | null {
  if (handling !== "premium_rate") return null;
  const value = Number(multiplier);
  if (multiplier.trim() === "" || !Number.isFinite(value)) return "Premium rate needs a multiplier, for example 1.5.";
  if (value < 1) return "The multiplier must be 1 or more.";
  return null;
}

/** The rule set as the editor holds it; numbers stay text until they are sent. */
export interface RulesDraft {
  handling: AfterHoursHandling;
  multiplier: string;
  overageRule: OverageRule;
  overageMultiplier: string;
  rolloverRule: RolloverRule;
  capHours: string;
  /** The percentages as a comma list ("50, 75, 90, 100"). */
  thresholds: string;
  notifyClient: boolean;
  forecastWindow: string;
}

function numberText(value: string | null, fallback: string): string {
  return value ? String(Number(value)) : fallback;
}

export function draftFromContract(contract: Contract): RulesDraft {
  return {
    handling: contract.after_hours_handling,
    multiplier: numberText(contract.after_hours_multiplier, "1.5"),
    overageRule: contract.overage_rule,
    overageMultiplier: numberText(contract.overage_multiplier, "1.25"),
    rolloverRule: contract.rollover_rule,
    capHours: numberText(contract.rollover_cap_hours, ""),
    thresholds: contract.threshold_percents.join(", "),
    notifyClient: contract.threshold_notify_client,
    forecastWindow: String(contract.forecast_window_days),
  };
}

const THRESHOLDS_PROBLEM =
  "Thresholds are whole percentages from 1 to 1000, up to ten of them, separated by commas, for example 50, 75, 90, 100.";

/** The comma list as percentages, deduplicated and ascending; null when a part is not a usable whole percentage. */
export function parseThresholds(text: string): number[] | null {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const values: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (value < 1 || value > 1000) return null;
    if (!values.includes(value)) values.push(value);
  }
  if (values.length > 10) return null;
  return values.sort((a, b) => a - b);
}

/** Why the rules cannot be sent yet, in the screen's words; null when they can. */
export function validateRules(draft: RulesDraft): string | null {
  const handling = validateHandling(draft.handling, draft.multiplier);
  if (handling) return handling;
  if (parseThresholds(draft.thresholds) === null) return THRESHOLDS_PROBLEM;
  if (draft.overageRule === "allow_rate") {
    const value = Number(draft.overageMultiplier);
    if (draft.overageMultiplier.trim() === "" || !Number.isFinite(value))
      return "Allow at overage rate needs a multiplier, for example 1.25.";
    if (value < 1) return "The overage multiplier must be 1 or more.";
  }
  if (draft.rolloverRule === "cap") {
    const value = Number(draft.capHours);
    if (draft.capHours.trim() === "" || !Number.isFinite(value) || value < 0)
      return "Cap needs the carried hours limit, for example 20.";
  }
  const window = Number(draft.forecastWindow);
  if (!Number.isInteger(window) || window < 1 || window > 90)
    return "The forecast window is a whole number of business days from 1 to 90.";
  return null;
}

/**
 * The PATCH body (TB-09, TB-11, TB-13): the whole rule set with the
 * version the screen holds; a multiplier or a cap travels only under the
 * rule that needs it (the server nulls the rest).
 */
export function rulesBody(version: number, draft: RulesDraft): PatchContractBody {
  return {
    version,
    after_hours_handling: draft.handling,
    ...(draft.handling === "premium_rate" ? { after_hours_multiplier: Number(draft.multiplier) } : {}),
    threshold_percents: parseThresholds(draft.thresholds) ?? [],
    threshold_notify_client: draft.notifyClient,
    overage_rule: draft.overageRule,
    ...(draft.overageRule === "allow_rate" ? { overage_multiplier: Number(draft.overageMultiplier) } : {}),
    rollover_rule: draft.rolloverRule,
    ...(draft.rolloverRule === "cap" ? { rollover_cap_hours: Number(draft.capHours) } : {}),
    forecast_window_days: Number(draft.forecastWindow),
  };
}

function describeContractError(error: unknown): string {
  const parsed = apiError(error);
  if (parsed.code === "multiplier_required") {
    const handling =
      typeof error === "object" && error !== null && "data" in error
        ? (error as { data?: { handling?: unknown } }).data?.handling
        : undefined;
    return handling === "allow_rate"
      ? "Allow at overage rate needs a multiplier, for example 1.25."
      : "Premium rate needs a multiplier, for example 1.5.";
  }
  if (parsed.code === "cap_required") return "Cap needs the carried hours limit, for example 20.";
  if (parsed.code === "stale_version") return "Someone else changed this contract. It has been reloaded.";
  if (parsed.code === "not_found") return "This contract is not on this account any more.";
  return describeError(parsed);
}

const HELP: Record<AfterHoursHandling, string> = {
  premium_rate: "After-hours, weekend and holiday entries carry this multiplier when logged.",
  comp_time: "Non-standard entries are counted for comp time on the account's comp-time report.",
  none: "Non-standard entries are badged but carry no premium and no comp time.",
};

const OVERAGE_HELP: Record<OverageRule, string> = {
  block: "An entry that would take the period past its budget is refused.",
  allow_flag: "The entry saves and is flagged over budget.",
  allow_rate: "The entry saves at the overage rate and this multiplier.",
};

const ROLLOVER_HELP: Record<RolloverRule, string> = {
  none: "Unused hours expire at period end.",
  carry_month: "Unused hours carry into the next period only, then expire.",
  carry_term: "Unused hours accumulate until the contract ends.",
  cap: "Unused hours accumulate, but the carried balance never exceeds the cap.",
};

/**
 * The inline editor for one contract's rules (TB-09, TB-11, TB-13): the
 * after-hours handling with its multiplier, the overage rule with its
 * multiplier under allow_rate, the rollover rule with its cap under cap,
 * the thresholds as a comma list, the client notification and the
 * forecast window, saved as one set through PATCH with the version the
 * screen holds. multiplier_required, cap_required and a stale version
 * come back in the screen's words; the stale one also reloads the list.
 */
function ContractRulesEditor({
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
  const [draft, setDraft] = useState<RulesDraft>(() => draftFromContract(contract));
  const [problem, setProblem] = useState<string | null>(null);
  const [patch, patchState] = usePatchContractMutation();
  const { push } = useToast();
  const track = useTrack("contract.rules.save");
  const set = (next: Partial<RulesDraft>) => setDraft({ ...draft, ...next });

  const onSave = async () => {
    const invalid = validateRules(draft);
    setProblem(invalid);
    if (invalid) return;
    try {
      const saved = await patch({
        accountId,
        contractId: contract.id,
        body: rulesBody(contract.version, draft),
      }).unwrap();
      track({
        account_id: accountId,
        contract_id: contract.id,
        handling: saved.after_hours_handling,
        overage_rule: saved.overage_rule,
        rollover_rule: saved.rollover_rule,
        version: saved.version,
      });
      push({
        title: "Contract rules saved",
        detail: `${contract.key}: ${handlingCell(saved)}; ${rulesCell(saved)}.`,
        tone: "success",
      });
      onDone();
    } catch (caught) {
      setProblem(describeContractError(caught));
      if (apiError(caught).code === "stale_version") refetch();
    }
  };

  return (
    <Panel title={`Contract rules for ${contract.key}`} caption={`${contract.name}, version ${contract.version}`}>
      <div className="flex flex-col gap-4 text-[12px]" data-rules-editor={contract.id}>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xms-ink font-semibold">After hours</legend>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xms-label">Handling</span>
              <select
                aria-label="After-hours handling"
                className={cn(INPUT, "w-[200px]")}
                value={draft.handling}
                onChange={(event) => set({ handling: event.target.value as AfterHoursHandling })}
              >
                {AFTER_HOURS_HANDLINGS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {draft.handling === "premium_rate" ? (
              <label className="flex flex-col gap-1">
                <span className="text-xms-label">Multiplier</span>
                <input
                  aria-label="Multiplier"
                  inputMode="decimal"
                  className={cn(INPUT, "xms-mono w-[110px]")}
                  value={draft.multiplier}
                  onChange={(event) => set({ multiplier: event.target.value })}
                />
              </label>
            ) : null}
          </div>
          <p className="text-xms-label">{HELP[draft.handling]}</p>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xms-ink font-semibold">Budget</legend>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xms-label">Overage</span>
              <select
                aria-label="Overage rule"
                className={cn(INPUT, "w-[200px]")}
                value={draft.overageRule}
                onChange={(event) => set({ overageRule: event.target.value as OverageRule })}
              >
                {OVERAGE_RULES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {draft.overageRule === "allow_rate" ? (
              <label className="flex flex-col gap-1">
                <span className="text-xms-label">Overage multiplier</span>
                <input
                  aria-label="Overage multiplier"
                  inputMode="decimal"
                  className={cn(INPUT, "xms-mono w-[110px]")}
                  value={draft.overageMultiplier}
                  onChange={(event) => set({ overageMultiplier: event.target.value })}
                />
              </label>
            ) : null}
            <p className="text-xms-label pb-2">{OVERAGE_HELP[draft.overageRule]}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xms-label">Rollover</span>
              <select
                aria-label="Rollover rule"
                className={cn(INPUT, "w-[200px]")}
                value={draft.rolloverRule}
                onChange={(event) => set({ rolloverRule: event.target.value as RolloverRule })}
              >
                {ROLLOVER_RULES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {draft.rolloverRule === "cap" ? (
              <label className="flex flex-col gap-1">
                <span className="text-xms-label">Cap (hours)</span>
                <input
                  aria-label="Cap hours"
                  inputMode="decimal"
                  className={cn(INPUT, "xms-mono w-[110px]")}
                  value={draft.capHours}
                  onChange={(event) => set({ capHours: event.target.value })}
                />
              </label>
            ) : null}
            <p className="text-xms-label pb-2">{ROLLOVER_HELP[draft.rolloverRule]}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xms-label">Thresholds (percent, comma separated)</span>
              <input
                aria-label="Thresholds"
                className={cn(INPUT, "xms-mono w-[220px]")}
                value={draft.thresholds}
                onChange={(event) => set({ thresholds: event.target.value })}
                placeholder="50, 75, 90, 100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xms-label">Forecast window (business days)</span>
              <input
                aria-label="Forecast window days"
                inputMode="numeric"
                className={cn(INPUT, "xms-mono w-[90px]")}
                value={draft.forecastWindow}
                onChange={(event) => set({ forecastWindow: event.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                aria-label="Notify the client contact at each threshold"
                checked={draft.notifyClient}
                onChange={(event) => set({ notifyClient: event.target.checked })}
              />
              <span className="text-xms-ink">Notify the client contact at each threshold</span>
            </label>
          </div>
          <p className="text-xms-label">
            Each threshold fires once per period, to the account owners and, when ticked, the client contact.
          </p>
        </fieldset>

        <InlineError message={problem} />
        <div className="flex items-center gap-2">
          <button type="button" className={PRIMARY_BUTTON} onClick={onSave} disabled={patchState.isLoading}>
            Save rules
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
 * model, status, after-hours handling, budget rules) under tickets:view,
 * with an inline edit of the rules under contracts:manage, and the rate
 * cards beneath. The API decides either way.
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
    {
      key: "rules",
      title: "Budget rules",
      sortValue: (row) => row.overage_rule,
      render: (row) => (
        <span className="text-xms-body text-[12px]" data-rules={row.id}>
          {rulesCell(row)}
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
                aria-label={`Edit rules for ${row.key}`}
              >
                Edit rules
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
        <ContractRulesEditor
          key={`${current.id}:${current.version}`}
          accountId={accountId}
          contract={current}
          onDone={() => setEditing(null)}
          refetch={contracts.refetch}
        />
      ) : null}
      {contracts.data ? <RateCardsPanel accountId={accountId} contracts={rows} /> : null}
    </div>
  );
}
