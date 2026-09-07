"use client";

import { useState } from "react";
import { INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { ROLE_OPTIONS, roleLabel } from "@/lib/roster/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import type { Contract } from "@/redux/ticketsApi";
import { useCreateRateCardMutation, useRateCardsQuery, type CreateRateCardBody, type RateCard } from "@/redux/timeApi";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Za-z]{3}$/;

export interface RateLineDraft {
  role: string;
  billRate: string;
  overageRate: string;
}

export interface RateCardDraft {
  effectiveFrom: string;
  currency: string;
  note: string;
  lines: RateLineDraft[];
}

export function emptyRateCardDraft(currency: string): RateCardDraft {
  return {
    effectiveFrom: "",
    currency,
    note: "",
    lines: [{ role: ROLE_OPTIONS[0].value, billRate: "", overageRate: "" }],
  };
}

function money(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** Why the draft cannot be sent yet, in the screen's words; null when it can. Roles repeating is the server's call. */
export function validateRateCard(draft: RateCardDraft): string | null {
  if (!DATE.test(draft.effectiveFrom)) return "Choose the effective date.";
  if (!CURRENCY.test(draft.currency.trim())) return "Currency is a three-letter code, for example USD.";
  if (draft.lines.length === 0) return "Add at least one role.";
  for (const line of draft.lines) {
    if (!line.role) return "Choose a role on every line.";
    if (money(line.billRate) === null) return `Bill rate for ${roleLabel(line.role)} must be a number, 0 or more.`;
    if (line.overageRate.trim() !== "" && money(line.overageRate) === null)
      return `Overage rate for ${roleLabel(line.role)} must be a number, 0 or more, or empty.`;
  }
  return null;
}

/** The PUT body: the contract when the version is the contract's own, the entries with the overage rate only when given. */
export function toRateCardBody(draft: RateCardDraft, contractId?: string): CreateRateCardBody {
  return {
    ...(contractId ? { contract_id: contractId } : {}),
    effective_from: draft.effectiveFrom,
    currency: draft.currency.trim().toUpperCase(),
    ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
    entries: draft.lines.map((line) => {
      const overage = money(line.overageRate);
      return {
        role: line.role,
        bill_rate: money(line.billRate) ?? 0,
        ...(overage === null ? {} : { overage_rate: overage }),
      };
    }),
  };
}

/** rate_card_exists and duplicate_role in the screen's words; the rest through the shared copy. */
export function describeRateCardError(error: unknown): string {
  const parsed = apiError(error);
  if (parsed.code === "rate_card_exists") {
    const date =
      typeof error === "object" && error !== null && "data" in error
        ? (error as { data?: { effective_from?: unknown } }).data?.effective_from
        : undefined;
    return `A version already starts on ${typeof date === "string" ? date : "that date"}. Versions are never edited; choose a later effective date for the change.`;
  }
  if (parsed.code === "duplicate_role") return "Each role can appear once on a version.";
  if (parsed.code === "not_found") return "This contract is not on this account any more.";
  return describeError(parsed);
}

function rate(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** One version: the effective date, the currency and a line per role. */
function RateCardVersion({ card }: { card: RateCard }) {
  return (
    <li className="border-xms-line flex flex-col gap-1 border-b py-2 last:border-b-0" data-rate-card={card.id}>
      <div className="flex items-center gap-2 text-[12px]">
        <span className="text-xms-label">Effective</span>
        <span className="xms-mono text-xms-ink" data-effective-from>
          {card.effective_from}
        </span>
        <span className="xms-mono text-xms-label">{card.currency}</span>
        {card.note ? <span className="text-xms-label truncate">{card.note}</span> : null}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        {card.entries.map((entry) => (
          <li key={entry.role} className="text-xms-ink" data-role={entry.role}>
            {roleLabel(entry.role)} <span className="xms-mono">{rate(entry.bill_rate)}</span>
            {entry.overage_rate !== null ? (
              <span className="text-xms-label">
                {" "}
                (overage <span className="xms-mono">{rate(entry.overage_rate)}</span>)
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** The New version form: effective date, currency, note and a line per role with the bill rate and the overage rate. */
export function NewRateCardForm({
  accountId,
  contract,
  onDone,
}: {
  accountId: string;
  /** The contract the version belongs to; undefined for an account default. */
  contract?: Pick<Contract, "id" | "key" | "currency">;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<RateCardDraft>(() => emptyRateCardDraft(contract?.currency ?? "USD"));
  const [problem, setProblem] = useState<string | null>(null);
  const [create, createState] = useCreateRateCardMutation();
  const { push } = useToast();
  const track = useTrack("rate_card.create");
  const scope = contract ? contract.key : "the account default";

  const setLine = (index: number, patch: Partial<RateLineDraft>) =>
    setDraft({ ...draft, lines: draft.lines.map((line, at) => (at === index ? { ...line, ...patch } : line)) });

  return (
    <form
      aria-label={`New rate card version for ${scope}`}
      className="border-xms-line mt-2 flex flex-col gap-3 rounded-[6px] border p-3 text-[12px]"
      onSubmit={async (event) => {
        event.preventDefault();
        const invalid = validateRateCard(draft);
        setProblem(invalid);
        if (invalid) return;
        try {
          const saved = await create({ accountId, body: toRateCardBody(draft, contract?.id) }).unwrap();
          track({ account_id: accountId, contract_id: contract?.id ?? null, roles: saved.entries.length });
          push({
            title: "Rate card version saved",
            detail: `${contract ? contract.key : "Account default"}: effective ${saved.effective_from}, ${saved.entries.length} role${saved.entries.length === 1 ? "" : "s"}.`,
            tone: "success",
          });
          onDone();
        } catch (caught) {
          setProblem(describeRateCardError(caught));
        }
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Effective from</span>
          <input
            aria-label="Effective from"
            type="date"
            className={cn(INPUT, "xms-mono w-[150px]")}
            value={draft.effectiveFrom}
            onChange={(event) => setDraft({ ...draft, effectiveFrom: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xms-label">Currency</span>
          <input
            aria-label="Currency"
            className={cn(INPUT, "xms-mono w-[80px] uppercase")}
            maxLength={3}
            value={draft.currency}
            onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
          />
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-xms-label">Note</span>
          <input
            aria-label="Note"
            className={INPUT}
            value={draft.note}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            placeholder="Why this version"
          />
        </label>
      </div>
      <table className="w-full border-collapse" aria-label="Rate lines">
        <thead>
          <tr className="text-xms-label text-left">
            <th className="py-1 pr-3 font-normal">Role</th>
            <th className="py-1 pr-3 font-normal">Bill rate per hour</th>
            <th className="py-1 pr-3 font-normal">Overage rate per hour</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {draft.lines.map((line, index) => (
            <tr key={index} data-rate-line={index + 1}>
              <td className="py-1 pr-3">
                <select
                  aria-label={`Role ${index + 1}`}
                  className={cn(INPUT, "w-[190px]")}
                  value={line.role}
                  onChange={(event) => setLine(index, { role: event.target.value })}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1 pr-3">
                <input
                  aria-label={`Bill rate ${index + 1}`}
                  inputMode="decimal"
                  className={cn(INPUT, "xms-mono w-[110px]")}
                  value={line.billRate}
                  onChange={(event) => setLine(index, { billRate: event.target.value })}
                />
              </td>
              <td className="py-1 pr-3">
                <input
                  aria-label={`Overage rate ${index + 1}`}
                  inputMode="decimal"
                  className={cn(INPUT, "xms-mono w-[110px]")}
                  value={line.overageRate}
                  onChange={(event) => setLine(index, { overageRate: event.target.value })}
                  placeholder="optional"
                />
              </td>
              <td className="py-1">
                <button
                  type="button"
                  className={cn(SECONDARY_BUTTON, "h-[26px] px-2 text-[12px]")}
                  aria-label={`Remove line ${index + 1}`}
                  disabled={draft.lines.length === 1}
                  onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, at) => at !== index) })}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <button
          type="button"
          className={cn(SECONDARY_BUTTON, "h-[26px] px-2 text-[12px]")}
          onClick={() =>
            setDraft({
              ...draft,
              lines: [...draft.lines, { role: ROLE_OPTIONS[0].value, billRate: "", overageRate: "" }],
            })
          }
        >
          Add line
        </button>
      </div>
      <InlineError message={problem} />
      <div className="flex items-center gap-2">
        <button type="submit" className={PRIMARY_BUTTON} disabled={createState.isLoading}>
          Save version
        </button>
        <button type="button" className={SECONDARY_BUTTON} onClick={onDone} disabled={createState.isLoading}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** The versions of one scope (a contract's own or the account defaults), newest first, with the New version action. */
function VersionList({ accountId, contract, canEdit }: { accountId: string; contract?: Contract; canEdit: boolean }) {
  const { data, isLoading, isError } = useRateCardsQuery({ accountId, contractId: contract?.id });
  const [adding, setAdding] = useState(false);
  const scope = contract ? contract.key : "the account default";
  // The contract route also returns the account defaults it would fall back to; only the scope's own versions list here.
  const versions = (data ?? []).filter((card) => card.contract_id === (contract?.id ?? null));
  return (
    <div className="flex flex-col gap-2" data-rate-cards={contract?.id ?? "account"}>
      {isLoading && !data ? <Skeleton lines={2} /> : null}
      {isError ? <p className="text-xms-muted text-[12px]">The rate cards could not be loaded.</p> : null}
      {data ? (
        <ul aria-label={`Rate card versions for ${scope}`} className="flex flex-col">
          {versions.map((card) => (
            <RateCardVersion key={card.id} card={card} />
          ))}
          {versions.length === 0 ? (
            <li className="text-xms-label py-2 text-[12px]">
              {contract
                ? "No rate card of its own; entries take the account default in force on their date."
                : "No account default yet; entries without a contract card save unrated."}
            </li>
          ) : null}
        </ul>
      ) : null}
      {canEdit && !adding ? (
        <div>
          <button
            type="button"
            className={cn(SECONDARY_BUTTON, "h-[26px] px-2 text-[12px]")}
            onClick={() => setAdding(true)}
            aria-label={`New version for ${scope}`}
          >
            New version
          </button>
        </div>
      ) : null}
      {adding ? <NewRateCardForm accountId={accountId} contract={contract} onDone={() => setAdding(false)} /> : null}
    </div>
  );
}

function ContractRateCards({
  accountId,
  contract,
  canEdit,
}: {
  accountId: string;
  contract: Contract;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-xms-line border-b py-2 last:border-b-0" data-contract-rate-cards={contract.id}>
      <button
        type="button"
        className="text-xms-ink flex w-full items-center gap-2 text-left text-[13px]"
        aria-expanded={open}
        aria-label={`Rate cards for ${contract.key}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="xms-mono text-xms-label w-3 text-[11px]">{open ? "v" : ">"}</span>
        <span className="xms-mono text-xms-accent text-[12px]">{contract.key}</span>
        <span className="truncate">{contract.name}</span>
        <span className="xms-mono text-xms-label ml-auto text-[11px]">{contract.currency}</span>
      </button>
      {open ? (
        <div className="mt-2 pl-5">
          <VersionList accountId={accountId} contract={contract} canEdit={canEdit} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Rate cards on the Contracts tab (Time & Budget 5.4, TB-05): a disclosure
 * per contract listing its own versions (effective date, currency, a line
 * per role) with New version under contracts:manage, and the account
 * defaults that apply where a contract has no card of its own. A version
 * is never edited; a change is a new version from a later date.
 */
export function RateCardsPanel({ accountId, contracts }: { accountId: string; contracts: Contract[] }) {
  const me = useMe();
  const canEdit = me.hasPermission("contracts:manage");
  return (
    <Panel
      title="Rate cards"
      caption="Versions per contract, then the account defaults; entries freeze the rate in force on their date"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          {contracts.map((contract) => (
            <ContractRateCards key={contract.id} accountId={accountId} contract={contract} canEdit={canEdit} />
          ))}
          {contracts.length === 0 ? (
            <p className="text-xms-label text-[12px]">No contracts on this account yet.</p>
          ) : null}
        </div>
        <section aria-label="Account default rate cards" className="flex flex-col gap-2">
          <h3 className="text-xms-ink text-[13px] font-semibold">Account default</h3>
          <VersionList accountId={accountId} canEdit={canEdit} />
        </section>
      </div>
    </Panel>
  );
}
