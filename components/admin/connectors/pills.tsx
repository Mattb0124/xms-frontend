import { outboundStatusLabel, outboundStatusTone, type OutboundStatus } from "@/lib/connectors/outbound";
import {
  LINK_STATE_LABEL,
  healthLabel,
  healthTone,
  linkStateTone,
  mapStateLabel,
  mapStateTone,
  modeLabel,
  modeTone,
  outcomeLabel,
  outcomeTone,
  type ConnectorHealth,
  type ConnectorMode,
  type LinkState,
  type MapState,
  type RunOutcome,
  type SignalTone,
} from "@/lib/connectors/vocab";

/** Signal pill on the `--state-*` trios; connector health and outcomes are signals, never ticket states. */
export function SignalPill({ tone, label, title }: { tone: SignalTone; label: string; title?: string }) {
  return (
    <span className="aix-state-pill" data-state={tone} title={title}>
      {label}
    </span>
  );
}

export function HealthPill({ health, reason }: { health: ConnectorHealth; reason?: string | null }) {
  return <SignalPill tone={healthTone(health)} label={healthLabel(health)} title={reason ?? undefined} />;
}

export function ModePill({ mode }: { mode: ConnectorMode }) {
  return <SignalPill tone={modeTone(mode)} label={modeLabel(mode)} />;
}

export function MapStatePill({ state }: { state: MapState }) {
  return <SignalPill tone={mapStateTone(state)} label={mapStateLabel(state)} />;
}

export function OutcomePill({ outcome }: { outcome: RunOutcome }) {
  return <SignalPill tone={outcomeTone(outcome)} label={outcomeLabel(outcome)} />;
}

export function OutboundStatusPill({ status }: { status: OutboundStatus }) {
  return <SignalPill tone={outboundStatusTone(status)} label={outboundStatusLabel(status)} />;
}

export function LinkStatePill({ state }: { state: LinkState }) {
  return <SignalPill tone={linkStateTone(state)} label={LINK_STATE_LABEL[state]} />;
}
