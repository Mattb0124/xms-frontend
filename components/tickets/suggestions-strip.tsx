"use client";

import { useState } from "react";
import { AxelSuggestionCard } from "@/components/axel/suggestion-card";
import { Skeleton } from "@/components/xms/skeleton";
import { apiError } from "@/lib/admin/api-error";
import { switchOffTooltip, withheldLine } from "@/lib/axel/copy";
import { useMe } from "@/redux/me";
import {
  useAiSettingsQuery,
  useOpenSuggestionsQuery,
  useSuggestMutation,
  type AiCapability,
  type CutCapability,
  type EffectiveReason,
  type SuggestionView,
} from "@/redux/aiApi";
import type { TicketView } from "@/redux/ticketsApi";

const SWITCH_REASONS = new Set<string>(["switch_off", "residency", "kill_switch"]);

/** The permission a decision on a capability needs (contracts/ai decisionPermissionFor). */
export function decisionPermission(capability: AiCapability): string {
  switch (capability) {
    case "classify":
    case "prioritise":
    case "duplicate":
      return "tickets:work";
    case "time_entry":
    case "burn_anomaly":
      return "time:log";
    case "wsr_narrative":
      return "reports:manage";
    default:
      return "ai:use";
  }
}

const REQUEST_BUTTON =
  "border-xms-ai-border text-xms-body hover:bg-xms-card h-[28px] rounded-[4px] border px-3 text-[12px] font-medium disabled:opacity-50";

export interface AxelSuggestStripProps {
  ticket: TicketView;
  readOnly?: boolean;
  onDraftAccepted?: (text: string) => void;
}

/**
 * The "Axel suggests" strip on the ticket record (functional spec 5.4, 5.5):
 * open suggestions as cards per capability, Summarise and Draft reply on
 * demand. A withheld answer is a quiet line, never an error toast. When the
 * account switch is known to be off the strip does not exist.
 */
export function AxelSuggestStrip({ ticket, readOnly, onDraftAccepted }: AxelSuggestStripProps) {
  const me = useMe();
  const canRequest = me.hasPermission("ai:use") && !readOnly;
  const canReadSettings = me.hasPermission("ai:configure");
  const settings = useAiSettingsQuery(ticket.account_id, { skip: !canReadSettings });
  const open = useOpenSuggestionsQuery(ticket.id, { refetchOnFocus: true });
  const [suggest, { isLoading: requesting }] = useSuggestMutation();
  const [pending, setPending] = useState<CutCapability | null>(null);
  const [withheld, setWithheld] = useState<string | null>(null);
  const [offReason, setOffReason] = useState<EffectiveReason | null>(null);
  const [recent, setRecent] = useState<SuggestionView[]>([]);

  const effectiveOff = settings.data ? !settings.data.effective.on : offReason !== null;
  const offCause = settings.data?.effective.reason ?? offReason ?? undefined;
  const openItems = open.data ?? [];
  const recentIds = new Set(recent.map((item) => item.id));
  const cards = [...openItems.filter((item) => !recentIds.has(item.id)), ...recent];

  if (settings.data && !settings.data.effective.on) return null;
  if (!canRequest && cards.length === 0 && !open.isLoading) return null;

  const request = async (capability: CutCapability) => {
    setPending(capability);
    setWithheld(null);
    try {
      const view = await suggest({ capability, target_kind: "ticket", target_id: ticket.id }).unwrap();
      if (view.status === "withheld") {
        setWithheld(withheldLine(view.withheld_reason));
        if (view.withheld_reason && SWITCH_REASONS.has(view.withheld_reason)) {
          setOffReason(view.withheld_reason as EffectiveReason);
        }
      }
    } catch (error) {
      const parsed = apiError(error);
      setWithheld(
        parsed.code === "forbidden"
          ? "You need the ai:use permission to ask Axel."
          : `Axel could not answer (${parsed.code}). Everything else on this ticket still works.`,
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <section aria-label="Axel suggests" className="flex flex-col gap-2" data-testid="axel-suggest-strip">
      <div className="flex flex-wrap items-center gap-2">
        <span className="xms-caption text-xms-ai-accent">Axel suggests</span>
        {canRequest ? (
          <>
            <button
              type="button"
              className={REQUEST_BUTTON}
              disabled={requesting || effectiveOff}
              title={effectiveOff ? switchOffTooltip(offCause) : "Summarise the thread so far"}
              onClick={() => void request("summarise")}
            >
              {pending === "summarise" ? "Summarising" : "Summarise"}
            </button>
            <button
              type="button"
              className={REQUEST_BUTTON}
              disabled={requesting || effectiveOff}
              title={effectiveOff ? switchOffTooltip(offCause) : "Draft a public reply from the thread"}
              onClick={() => void request("draft_reply")}
            >
              {pending === "draft_reply" ? "Drafting" : "Draft reply"}
            </button>
          </>
        ) : null}
        {withheld ? (
          <span role="status" className="text-xms-label text-[12px]">
            {withheld}
          </span>
        ) : null}
        {effectiveOff && !withheld ? (
          <span className="text-xms-label text-[12px]">{switchOffTooltip(offCause)}</span>
        ) : null}
      </div>
      {open.isLoading ? <Skeleton lines={2} /> : null}
      {cards.length > 0 ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {cards.map((suggestion) => (
            <AxelSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              ticketKey={ticket.key}
              source="strip"
              canDecide={me.hasPermission(decisionPermission(suggestion.capability)) && !readOnly}
              onDraftAccepted={onDraftAccepted}
              onDecided={(decided) =>
                setRecent((current) => [...current.filter((item) => item.id !== decided.id), decided])
              }
            />
          ))}
        </div>
      ) : null}
      {!open.isLoading && cards.length === 0 && canRequest && !withheld ? (
        <p className="text-xms-label text-[12px]">Nothing suggested yet. Ask for a summary or a draft reply.</p>
      ) : null}
    </section>
  );
}
