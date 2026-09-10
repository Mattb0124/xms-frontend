"use client";

import { useState } from "react";
import { HealthPill } from "@/components/admin/connectors/pills";
import { ReasonDialog } from "@/components/admin/connectors/reason-dialog";
import { DANGER_BUTTON, InlineError, RecordBar, SECONDARY_BUTTON, formatDate } from "@/components/admin/primitives";
import { MODES, bidirectionalBlocker, type ConnectorMode } from "@/lib/connectors/vocab";
import { describeConnectorError } from "@/lib/connectors/errors";
import { useConnectorErrors } from "@/lib/connectors/use-connector-errors";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import {
  useKillSwitchMutation,
  useTestConnectionMutation,
  useUpdateConnectorMutation,
  type ConnectorInstance,
  type TestConnectionResult,
} from "@/redux/connectorsApi";

/**
 * Off / Ingest only / Bidirectional. Every mode is offered: the API decides
 * whether an instance may write into the client, and refuses with
 * no_active_field_map, no_active_state_map or credential_not_valid. The
 * refusal is shown here in words rather than swallowed, and what the promotion
 * still needs is said before the click as well (SN-09).
 */
export function ModeSwitch({ instance, refetch }: { instance: ConnectorInstance; refetch?: () => unknown }) {
  const [update, { isLoading }] = useUpdateConnectorMutation();
  const onError = useConnectorErrors(refetch);
  const track = useTrack("connector.mode");
  const [refused, setRefused] = useState<string | null>(null);
  const blocker = bidirectionalBlocker(instance);
  const set = async (mode: ConnectorMode) => {
    if (mode === instance.mode) return;
    setRefused(null);
    try {
      await update({ id: instance.id, body: { version: instance.version, mode } }).unwrap();
      track({ instance_id: instance.id, from: instance.mode, to: mode });
    } catch (caught) {
      setRefused(describeConnectorError(onError(caught)));
    }
  };
  return (
    <div className="flex flex-col items-start gap-1">
      <div
        role="radiogroup"
        aria-label="Mode"
        className="border-xms-line inline-flex h-[32px] overflow-hidden rounded-[4px] border"
      >
        {MODES.map((option) => {
          const active = instance.mode === option.value;
          const hint = option.value === "bidirectional" ? (blocker ?? undefined) : undefined;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={isLoading}
              title={hint}
              onClick={() => void set(option.value)}
              className={cn(
                "border-xms-line px-3 text-[14px] [&:not(:last-child)]:border-r",
                active ? "bg-xms-tint text-xms-accent font-medium" : "text-xms-body hover:bg-xms-row-hover",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {refused ? (
        <p className="text-[14px] text-[color:var(--state-overdue-text)]" data-mode-refused>
          {refused}
        </p>
      ) : blocker && instance.mode !== "bidirectional" ? (
        <p className="text-xms-label text-[14px]" data-mode-hint>
          {blocker}
        </p>
      ) : null}
    </div>
  );
}

/** Trip with a reason; arm with a reason. Both are security events on the server. */
export function KillSwitchControl({ instance, refetch }: { instance: ConnectorInstance; refetch?: () => unknown }) {
  const [act, { isLoading }] = useKillSwitchMutation();
  const onError = useConnectorErrors(refetch);
  const trackTrip = useTrack("connector.trip");
  const trackArm = useTrack("connector.arm");
  const [open, setOpen] = useState<"trip" | "arm" | null>(null);
  const tripped = instance.kill_switch === "tripped";
  return (
    <>
      <button
        type="button"
        className={tripped ? SECONDARY_BUTTON : DANGER_BUTTON}
        disabled={isLoading}
        onClick={() => setOpen(tripped ? "arm" : "trip")}
      >
        {tripped ? "Arm kill switch" : "Trip kill switch"}
      </button>
      {open ? (
        <ReasonDialog
          title={open === "trip" ? "Trip the kill switch" : "Arm the kill switch"}
          detail={
            open === "trip"
              ? "Dispatch stops now and inbound apply pauses. Queued work waits until the switch is armed again."
              : "Dispatch and inbound apply resume, in order. The account owner is notified."
          }
          confirmLabel={open === "trip" ? "Trip" : "Arm"}
          danger={open === "trip"}
          required
          busy={isLoading}
          onClose={() => setOpen(null)}
          onConfirm={async (reason) => {
            try {
              await act({ id: instance.id, action: open, reason }).unwrap();
              (open === "trip" ? trackTrip : trackArm)({ instance_id: instance.id });
              setOpen(null);
            } catch (caught) {
              onError(caught);
            }
          }}
        />
      ) : null}
    </>
  );
}

export function TestConnectionButton({ instance }: { instance: ConnectorInstance }) {
  const [test, { isLoading }] = useTestConnectionMutation();
  const [result, setResult] = useState<TestConnectionResult | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className={SECONDARY_BUTTON}
        disabled={isLoading}
        onClick={async () => {
          try {
            setResult(await test(instance.id).unwrap());
          } catch {
            setResult({ ok: false, error: "The API could not run the test.", latency_ms: 0 });
          }
        }}
      >
        {isLoading ? "Testing" : "Test connection"}
      </button>
      {result ? (
        result.ok ? (
          <span className="xms-mono text-[14px] text-[color:var(--state-complete-text)]" data-test="ok">
            Connected, {result.fields ?? 0} fields, {result.latency_ms} ms
          </span>
        ) : (
          <span className="text-[14px] text-[color:var(--state-overdue-text)]" data-test="failed" title={result.error}>
            Failed: {result.error}
          </span>
        )
      ) : null}
    </span>
  );
}

/** The record bar plus the identity line: table, URL, credential state, kill switch reason, last error. */
export function InstanceHeader({ instance, refetch }: { instance: ConnectorInstance; refetch?: () => unknown }) {
  return (
    <div className="mb-4 flex flex-col gap-2">
      <RecordBar
        keyText={instance.table_name}
        title={instance.name}
        pill={<HealthPill health={instance.health} reason={instance.trip_reason} />}
        actions={
          <>
            <ModeSwitch instance={instance} refetch={refetch} />
            <TestConnectionButton instance={instance} />
            <KillSwitchControl instance={instance} refetch={refetch} />
          </>
        }
      />
      <div className="text-xms-label flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
        <span className="xms-mono">{instance.base_url}</span>
        <span>
          {instance.auth_kind === "basic" ? "Basic auth" : "OAuth client credentials"}, credential{" "}
          {instance.credential_state}
        </span>
        <span>Profile {instance.profile.toUpperCase()}</span>
        <span className="xms-mono">
          watermark {formatDate(instance.inbound_watermark)}, next poll {formatDate(instance.next_poll_at)}
        </span>
        {instance.active_field_map_id ? null : <span data-warning="no-field-map">No active field map</span>}
      </div>
      {instance.kill_switch === "tripped" ? (
        <InlineError
          message={`Kill switch tripped ${formatDate(instance.tripped_at)}: ${instance.trip_reason ?? "no reason recorded"}`}
        />
      ) : null}
      {instance.last_error ? (
        <p className="text-xms-body text-[14px]">
          <span className="text-xms-label">Last error {formatDate(instance.last_error_at)}:</span> {instance.last_error}
        </p>
      ) : null}
    </div>
  );
}
