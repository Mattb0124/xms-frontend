"use client";

import { useMemo, useState } from "react";
import { INPUT, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import {
  acknowledgementLabel,
  DELIVERY_STATUS,
  describeFinanceError,
  DESTINATION_KINDS,
  destinationBody,
  draftFromDestination,
  financeError,
  FINANCE_FORMATS,
  isDeliverable,
  responseStatusLabel,
  secretKidLabel,
  type DestinationDraft,
} from "@/lib/integrations/finance";
import { useTrack } from "@/lib/telemetry/provider";
import { periodLabel } from "@/lib/time/billing";
import { cn } from "@/lib/utils";
import {
  useDeliverPeriodNowMutation,
  useFinanceDeliveriesQuery,
  useFinanceDestinationQuery,
  useSetFinanceDestinationMutation,
  type DestinationKind,
  type FinanceDelivery,
  type FinanceDestination,
  type FinanceFormat,
} from "@/redux/integrationsApi";
import { useMe } from "@/redux/me";
import { useBillingPeriodsQuery } from "@/redux/timeApi";

const HEAD = "text-xms-ink px-3 py-2 text-left text-[12px] font-semibold whitespace-nowrap";
const CELL = "text-xms-ink px-3 py-2 align-top text-[13px]";
const SMALL = "h-[26px] px-2 text-[12px]";

export function DeliveryStatusPill({ status }: { status: FinanceDelivery["status"] }) {
  const { label, tone } = DELIVERY_STATUS[status];
  return <SignalPill tone={tone} label={label} />;
}

/** The signing secret, once: the API mints it on the first HTTPS set and when the endpoint changes. */
export function NewSecretPanel({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Panel
      title="Signing secret"
      caption="Shown once"
      actions={
        <button type="button" className={cn(SECONDARY_BUTTON, SMALL)} onClick={onDismiss}>
          I have stored it
        </button>
      }
    >
      <div className="flex flex-col gap-2" data-testid="new-finance-secret">
        <p className="text-[13px] text-[color:var(--state-needs-input-text)]">
          Give this secret to finance now so they can check the signature on each delivery. It will not be shown again;
          saving the endpoint afresh mints a new one.
        </p>
        <div className="flex items-center gap-2">
          <code
            className="border-xms-line bg-xms-tint text-xms-ink xms-mono flex-1 overflow-x-auto rounded-[4px] border px-2 py-2 text-[12px]"
            data-secret
          >
            {secret}
          </code>
          <button
            type="button"
            className={cn(SECONDARY_BUTTON, SMALL)}
            onClick={() => {
              void navigator.clipboard?.writeText(secret);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </Panel>
  );
}

/**
 * The destination editor, keyed on the record's version by its parent, so a
 * fresh record seeds the draft by remount and a draft in flight is never
 * overwritten under the hand editing it.
 */
function DestinationEditor({
  accountId,
  destination,
  onSecret,
}: {
  accountId: string;
  destination: FinanceDestination | null;
  onSecret: (secret: string) => void;
}) {
  const [save, { isLoading: saving }] = useSetFinanceDestinationMutation();
  const track = useTrack("finance.destination.set");
  const { push } = useToast();
  const [draft, setDraft] = useState<DestinationDraft>(() => draftFromDestination(destination));
  const [error, setError] = useState<string | null>(null);
  const data = destination;

  const set = (patch: Partial<DestinationDraft>) => setDraft((previous) => ({ ...previous, ...patch }));

  return (
    <>
      <form
        className="flex flex-col gap-3"
        aria-label="Finance destination"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            const saved = await save({ accountId, body: destinationBody(draft) }).unwrap();
            track({ account_id: accountId, kind: saved.kind, enabled: saved.enabled });
            if (saved.secret) onSecret(saved.secret);
            push({
              title: "Destination saved",
              detail: `${DESTINATION_KINDS[saved.kind].label}, ${FINANCE_FORMATS[saved.format]}`,
              tone: "success",
            });
          } catch (caught) {
            setError(describeFinanceError(financeError(caught)));
          }
        }}
      >
        <fieldset className="flex flex-col gap-1">
          <legend className="text-xms-label text-[12px]">Kind</legend>
          {(Object.keys(DESTINATION_KINDS) as DestinationKind[]).map((kind) => (
            <label key={kind} className="flex items-start gap-2 text-[13px]">
              <input
                type="radio"
                name="destination-kind"
                className="mt-[3px]"
                checked={draft.kind === kind}
                onChange={() => set({ kind })}
              />
              <span>
                <span className="text-xms-ink">{DESTINATION_KINDS[kind].label}</span>
                <span className="text-xms-label"> {DESTINATION_KINDS[kind].detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {draft.kind === "https" ? (
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Endpoint URL</span>
            <input
              aria-label="Endpoint URL"
              className={cn(INPUT, "xms-mono")}
              placeholder="https://finance.example.com/xms/billing"
              value={draft.endpointUrl}
              onChange={(event) => set({ endpointUrl: event.target.value })}
            />
            {data && data.kind === "https" ? (
              <span className="text-xms-label" data-secret-kid>
                {secretKidLabel(data)}. Changing the endpoint mints a new secret, shown once.
              </span>
            ) : (
              <span className="text-xms-label">Saving an HTTPS endpoint mints a signing secret, shown once.</span>
            )}
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Object prefix</span>
            <input
              aria-label="Object prefix"
              className={cn(INPUT, "xms-mono")}
              placeholder="finance/xms"
              value={draft.objectPrefix}
              onChange={(event) => set({ objectPrefix: event.target.value })}
            />
            <span className="text-xms-label">
              Lower case letters, digits and the separators / _ . and -, up to 200 characters.
            </span>
          </label>
        )}
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-xms-label">Format</span>
          <select
            className={cn(INPUT, "w-[200px]")}
            value={draft.format}
            onChange={(event) => set({ format: event.target.value as FinanceFormat })}
          >
            {(Object.keys(FINANCE_FORMATS) as FinanceFormat[]).map((format) => (
              <option key={format} value={format}>
                {FINANCE_FORMATS[format]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={draft.enabled} onChange={(event) => set({ enabled: event.target.checked })} />
          <span className="text-xms-ink">Enabled</span>
          <span className="text-xms-label text-[12px]">A disabled destination refuses every delivery.</span>
        </label>
        <InlineError message={error} />
        <div>
          <button type="submit" className={PRIMARY_BUTTON} disabled={saving}>
            Save destination
          </button>
        </div>
      </form>
    </>
  );
}

/** The account's one destination: kind, where it goes, the format and whether it is on. */
function DestinationForm({ accountId }: { accountId: string }) {
  const { data, isLoading, isError } = useFinanceDestinationQuery(accountId);
  const [secret, setSecret] = useState<string | null>(null);

  if (isLoading && data === undefined) return <Skeleton lines={5} />;

  return (
    <div className="flex flex-col gap-4">
      {secret ? <NewSecretPanel secret={secret} onDismiss={() => setSecret(null)} /> : null}
      <Panel title="Finance destination" caption={data ? `version ${data.version}` : "Not set yet"}>
        {isError ? <p className="text-xms-muted text-[13px]">The destination could not be loaded.</p> : null}
        <DestinationEditor
          key={data ? `${data.id}:${data.version}` : "empty"}
          accountId={accountId}
          destination={data ?? null}
          onSecret={setSecret}
        />
      </Panel>
    </div>
  );
}

/** Every hand-over of a locked period, newest first, with Deliver now over the locked periods. */
function DeliveriesPanel({ accountId }: { accountId: string }) {
  const me = useMe();
  const canReadPeriods = me.hasPermission("contracts:view");
  const { data, isLoading, isError } = useFinanceDeliveriesQuery({ account_id: accountId });
  const periods = useBillingPeriodsQuery(accountId, { skip: !canReadPeriods });
  const [deliver, { isLoading: delivering }] = useDeliverPeriodNowMutation();
  const track = useTrack("finance.deliver");
  const { push } = useToast();
  const [periodId, setPeriodId] = useState("");

  const deliverable = useMemo(
    () => (periods.data ?? []).filter((period) => isDeliverable(period.status)),
    [periods.data],
  );
  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const period of periods.data ?? []) map[period.id] = periodLabel(period);
    return map;
  }, [periods.data]);

  const chosen = periodId || deliverable[0]?.id || "";

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Deliver now" caption="A locked or exported period; a re-delivery supersedes the earlier one">
        {!canReadPeriods ? (
          <p className="text-xms-label text-[13px]">
            The billing periods need the contracts:view permission, so there is nothing to pick here.
          </p>
        ) : deliverable.length === 0 ? (
          <p className="text-xms-label text-[13px]">No period is locked yet. Lock one on the Billing tab first.</p>
        ) : (
          <form
            className="flex flex-wrap items-end gap-3"
            aria-label="Deliver a period"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const delivery = await deliver({ accountId, period_id: chosen }).unwrap();
                track({ account_id: accountId, period_id: chosen, status: delivery.status });
                push({
                  title: "Delivery started",
                  detail: `${names[chosen] ?? chosen}: ${DELIVERY_STATUS[delivery.status].label.toLowerCase()}`,
                  tone: "success",
                });
              } catch (caught) {
                push({ title: "Not delivered", detail: describeFinanceError(financeError(caught)), tone: "error" });
              }
            }}
          >
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="text-xms-label">Period</span>
              <select
                aria-label="Period"
                className={cn(INPUT, "h-[30px] w-[220px] text-[12px]")}
                value={chosen}
                onChange={(event) => setPeriodId(event.target.value)}
              >
                {deliverable.map((period) => (
                  <option key={period.id} value={period.id}>
                    {periodLabel(period)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={cn(PRIMARY_BUTTON, "h-[30px]")} disabled={delivering || !chosen}>
              Deliver now
            </button>
          </form>
        )}
      </Panel>
      <Panel title="Deliveries" caption="Newest first" flush>
        {isLoading && !data ? (
          <div className="p-4">
            <Skeleton lines={3} />
          </div>
        ) : null}
        {isError ? <p className="text-xms-muted p-4 text-[13px]">The deliveries could not be loaded.</p> : null}
        {data ? (
          <table className="w-full border-collapse" aria-label="Finance deliveries">
            <thead className="bg-xms-card">
              <tr className="border-xms-line border-b">
                <th className={HEAD}>Period</th>
                <th className={HEAD}>Destination</th>
                <th className={HEAD}>Status</th>
                <th className={HEAD}>Acknowledged</th>
                <th className={HEAD}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.map((delivery) => (
                <tr
                  key={delivery.id}
                  className="border-xms-line border-b align-top"
                  data-delivery={delivery.id}
                  data-status={delivery.status}
                >
                  <td className={CELL}>
                    <span className="flex flex-col">
                      <span className="text-xms-ink font-medium">
                        {names[delivery.billing_period_id] ?? delivery.billing_period_id.slice(0, 8)}
                      </span>
                      <span className="xms-mono text-xms-label text-[11px]">
                        {delivery.created_at.slice(0, 16).replace("T", " ")}
                      </span>
                    </span>
                  </td>
                  <td className={CELL}>
                    <span className="flex flex-col">
                      <span>{DESTINATION_KINDS[delivery.destination_kind].label}</span>
                      {delivery.manifest_key ? (
                        <span className="xms-mono text-xms-label text-[11px]" data-manifest>
                          {delivery.manifest_key}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className={CELL}>
                    <span className="flex flex-col gap-1">
                      <span>
                        <DeliveryStatusPill status={delivery.status} />
                      </span>
                      {delivery.supersedes_id ? (
                        <span className="text-xms-label text-[11px]" data-supersedes>
                          Supersedes {delivery.supersedes_id.slice(0, 8)}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className={cn(CELL, "text-[12px]")} data-ack>
                    {acknowledgementLabel(delivery)}
                  </td>
                  <td className={cn(CELL, "text-[12px]")}>
                    <span className="flex flex-col gap-0.5">
                      {delivery.response_status !== null ? (
                        <span className="xms-mono text-xms-label" data-response>
                          {responseStatusLabel(delivery)}
                        </span>
                      ) : null}
                      {delivery.error ? (
                        <span className="text-[color:var(--state-overdue-text)]" data-error>
                          {delivery.error}
                        </span>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-xms-label px-4 py-8 text-center text-[13px]">
                    Nothing delivered yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </Panel>
    </div>
  );
}

/**
 * The Finance tab on the admin account record (Integrations functional 5.3,
 * INT-02): the destination under `admin:connectors` with the signing secret
 * shown once when the API mints one, and the deliveries with Deliver now
 * under `time:lock-period`. Each half fails closed on its own permission and
 * the API is never asked without it.
 */
export function AccountFinanceTab({ accountId }: { accountId: string }) {
  const me = useMe();
  const canSetDestination = me.hasPermission("admin:connectors");
  const canDeliver = me.hasPermission("time:lock-period");

  if (!me.permissions) return <Skeleton lines={5} className="max-w-md" />;

  return (
    <div className="flex flex-col gap-4" data-testid="account-finance">
      {canSetDestination ? (
        <DestinationForm accountId={accountId} />
      ) : (
        <Panel title="Finance destination" caption="Needs the admin:connectors permission">
          <p className="text-xms-label text-[13px]">
            You can see this account but not where its locked billing exports are delivered.
          </p>
        </Panel>
      )}
      {canDeliver ? (
        <DeliveriesPanel accountId={accountId} />
      ) : (
        <Panel title="Deliveries" caption="Needs the time:lock-period permission">
          <p className="text-xms-label text-[13px]">
            The delivery history and Deliver now belong to whoever locks the billing periods.
          </p>
        </Panel>
      )}
    </div>
  );
}
