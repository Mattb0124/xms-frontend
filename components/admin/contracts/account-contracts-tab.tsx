"use client";

import { useState } from "react";
import { EngagementsPanel } from "@/components/admin/contracts/engagements-panel";
import { RateCardsPanel } from "@/components/admin/contracts/rate-cards";
import { useSkillName } from "@/components/capacity/account-coverage";
import { BucketsPanel } from "@/components/time/buckets-panel";
import { INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { Panel } from "@/components/xms/panel";
import { SignalPill, type SignalTone } from "@/components/xms/signal-pill";
import { useToast } from "@/components/xms/toast";
import { apiError } from "@/lib/admin/api-error";
import {
  HANDLING_HELP,
  OVERAGE_HELP,
  ROLLOVER_HELP,
  describeContractError,
  draftFromContract,
  handlingCell,
  rulesBody,
  rulesCell,
  validateRules,
  type RulesDraft,
} from "@/lib/contracts/rules";
import { useTrack } from "@/lib/telemetry/provider";
import { AFTER_HOURS_HANDLINGS, formatMultiplier } from "@/lib/time/after-hours";
import { engagementName } from "@/lib/contracts/engagements";
import { OVERAGE_RULES, ROLLOVER_RULES } from "@/lib/time/budget";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  useListAccountContractsQuery,
  useListEngagementsQuery,
  usePatchContractMutation,
  type AfterHoursHandling,
  type Contract,
  type Engagement,
  type OverageRule,
  type RolloverRule,
} from "@/redux/ticketsApi";

const MODEL_LABEL: Record<string, string> = {
  retainer: "Retainer",
  prepaid_block: "Prepaid block",
  time_and_materials: "Time and materials",
  fixed_fee: "Fixed fee",
};

/** Active is complete, a draft is waiting on input, anything else is blocked. */
const STATUS_TONE: Record<string, SignalTone> = { active: "complete", draft: "needs-input" };

function ContractStatusPill({ status }: { status: string }) {
  return (
    <SignalPill tone={STATUS_TONE[status] ?? "blocked"} label={status.charAt(0).toUpperCase() + status.slice(1)} />
  );
}

/** What each fieldset of the rules editor is handed: the draft, and the change to lay over it. */
export interface RulesFieldsetProps {
  draft: RulesDraft;
  onChange: (next: Partial<RulesDraft>) => void;
}

export interface EngagementFieldsetProps extends RulesFieldsetProps {
  engagements: Engagement[];
}

function EngagementFieldset({ draft, onChange, engagements }: EngagementFieldsetProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xms-ink font-semibold">Engagement</legend>
      <label className="flex flex-col gap-1">
        <span className="text-xms-label">Filed under</span>
        <select
          aria-label="Engagement"
          className={cn(INPUT, "w-[320px]")}
          value={draft.engagementId}
          onChange={(event) => onChange({ engagementId: event.target.value })}
        >
          <option value="">Not filed under an engagement</option>
          {engagements.map((engagement) => (
            <option key={engagement.id} value={engagement.id}>
              {engagement.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xms-label">
        {engagements.length === 0
          ? "This account has no engagement yet. Add one above and the contract can be filed under it."
          : "The engagement carries the renewal date and the notice period this contract is renewed against."}
      </p>
    </fieldset>
  );
}

function AfterHoursFieldset({ draft, onChange }: RulesFieldsetProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xms-ink font-semibold">After hours</legend>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Handling</span>
          <select
            aria-label="After-hours handling"
            className={cn(INPUT, "w-[200px]")}
            value={draft.handling}
            onChange={(event) => onChange({ handling: event.target.value as AfterHoursHandling })}
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
              onChange={(event) => onChange({ multiplier: event.target.value })}
            />
          </label>
        ) : null}
      </div>
      <p className="text-xms-label">{HANDLING_HELP[draft.handling]}</p>
    </fieldset>
  );
}

function BudgetFieldset({ draft, onChange }: RulesFieldsetProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xms-ink font-semibold">Budget</legend>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Overage</span>
          <select
            aria-label="Overage rule"
            className={cn(INPUT, "w-[200px]")}
            value={draft.overageRule}
            onChange={(event) => onChange({ overageRule: event.target.value as OverageRule })}
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
              onChange={(event) => onChange({ overageMultiplier: event.target.value })}
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
            onChange={(event) => onChange({ rolloverRule: event.target.value as RolloverRule })}
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
              onChange={(event) => onChange({ capHours: event.target.value })}
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
            onChange={(event) => onChange({ thresholds: event.target.value })}
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
            onChange={(event) => onChange({ forecastWindow: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            aria-label="Notify the client contact at each threshold"
            checked={draft.notifyClient}
            onChange={(event) => onChange({ notifyClient: event.target.checked })}
          />
          <span className="text-xms-ink">Notify the client contact at each threshold</span>
        </label>
      </div>
      <p className="text-xms-label">
        Each threshold fires once per period, to the account owners and, when ticked, the client contact.
      </p>
    </fieldset>
  );
}

function CoverageFieldset({ draft, onChange }: RulesFieldsetProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xms-ink font-semibold">Coverage</legend>
      <label className="flex flex-col gap-1">
        <span className="text-xms-label">Technologies (codes, comma separated)</span>
        <input
          aria-label="Technology codes"
          className={cn(INPUT, "xms-mono w-[320px]")}
          value={draft.technologies}
          onChange={(event) => onChange({ technologies: event.target.value })}
          placeholder="onestream, anaplan"
        />
      </label>
      <p className="text-xms-label">
        The skills matrix reads these codes: a technology one person covers at level 3 is a single point of failure, one
        nobody covers is a gap, and both show as chips on the account record.
      </p>
    </fieldset>
  );
}

export interface ContractRulesEditorProps {
  accountId: string;
  contract: Contract;
  engagements: Engagement[];
  onDone: () => void;
  refetch: () => unknown;
}

/**
 * The inline editor for one contract's rules (TB-09, TB-11, TB-13): the
 * engagement the contract is filed under, the after-hours handling with its
 * multiplier, the overage rule with its multiplier under allow_rate, the
 * rollover rule with its cap under cap, the thresholds as a comma list, the
 * client notification and the forecast window, saved as one set through
 * PATCH with the version the screen holds. multiplier_required, cap_required
 * and a stale version come back in the screen's words; the stale one also
 * reloads the list.
 */
function ContractRulesEditor({ accountId, contract, engagements, onDone, refetch }: ContractRulesEditorProps) {
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
      <div className="flex flex-col gap-4 text-body" data-rules-editor={contract.id}>
        <EngagementFieldset draft={draft} onChange={set} engagements={engagements} />
        <AfterHoursFieldset draft={draft} onChange={set} />
        <BudgetFieldset draft={draft} onChange={set} />
        <CoverageFieldset draft={draft} onChange={set} />
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
 * The account record's Contracts tab: the engagements this account's
 * contracts are filed under, then the contracts themselves (key, name,
 * engagement, model, status, after-hours handling, budget rules) under
 * contracts:view, the permission the API puts on /v1/accounts/:id/contracts,
 * on the engagements above and on the rate cards beneath, with an inline
 * edit of the rules under contracts:manage. The API decides either way.
 */
export function AccountContractsTab({ accountId }: { accountId: string }) {
  const me = useMe();
  const canRead = me.hasPermission("contracts:view");
  const canEdit = me.hasPermission("contracts:manage");
  const contracts = useListAccountContractsQuery(accountId, { skip: !canRead });
  // The same list the Engagements panel above reads, so the picker and the
  // column name the engagement rather than showing its id.
  const engagements = useListEngagementsQuery(accountId, { skip: !canRead });
  const skillName = useSkillName();
  const [editing, setEditing] = useState<string | null>(null);
  const rows = contracts.data ?? [];
  const current = rows.find((row) => row.id === editing) ?? null;

  if (!canRead) {
    return (
      <Panel title="Contracts" caption="Needs the contracts:view permission">
        <p className="text-xms-label text-body">You can see this account but not its contracts.</p>
      </Panel>
    );
  }

  const columns: DenseColumn<Contract>[] = [
    { key: "key", title: "Key", mono: true, sortValue: (row) => row.key },
    { key: "name", title: "Name", sortValue: (row) => row.name },
    {
      key: "engagement",
      title: "Engagement",
      sortValue: (row) => engagementName(row.engagement_id, engagements.data ?? []),
      render: (row) => (
        <span className="text-xms-body text-body" data-engagement={row.id}>
          {engagementName(row.engagement_id, engagements.data ?? [])}
        </span>
      ),
    },
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
            <span className="xms-mono text-xms-label ml-2 text-body">
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
        <span className="text-xms-body text-body" data-rules={row.id}>
          {rulesCell(row)}
        </span>
      ),
    },
    {
      key: "technologies",
      title: "Technologies",
      sortValue: (row) => row.technology_codes.length,
      render: (row) => (
        <span className="text-xms-body text-body" data-technologies={row.id} title={row.technology_codes.join(", ")}>
          {row.technology_codes.length > 0 ? row.technology_codes.map(skillName).join(", ") : "No codes"}
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
                className={cn(SECONDARY_BUTTON, "h-[26px] px-2 text-body")}
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
      <EngagementsPanel accountId={accountId} />
      <DenseTable
        title="Contracts"
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
          engagements={engagements.data ?? []}
          onDone={() => setEditing(null)}
          refetch={contracts.refetch}
        />
      ) : null}
      {contracts.data ? <RateCardsPanel accountId={accountId} contracts={rows} /> : null}
      {/*
        The non-ticket buckets (TB-12) sit here because their billable class
        is a commercial fact: it decides whether governance and QBR time
        burns the contract above. The panel holds its own time:log gate on
        the read, which contracts:view does not imply.
      */}
      <BucketsPanel accountId={accountId} />
    </div>
  );
}
