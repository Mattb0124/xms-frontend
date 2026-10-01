"use client";

import { useState } from "react";
import { ConfirmButton, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON, formatDate } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { SignalPill, type SignalTone } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast, type ToastItem } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { eligibleClients, eventsLabel, lastErrorLine, pausedLine } from "@/lib/integrations/webhooks";
import { cn } from "@/lib/utils";
import { useApiClientsQuery } from "@/redux/apiClientsApi";
import {
  useAccountWebhookDeadLettersQuery,
  useAccountWebhookDeliveriesQuery,
  useAccountWebhooksQuery,
  useCreateAccountWebhookMutation,
  useDeleteAccountWebhookMutation,
  usePauseAccountWebhookMutation,
  useReplayAccountWebhookMutation,
  useResumeAccountWebhookMutation,
  useRotateAccountWebhookSecretMutation,
  useWebhookEventTypesQuery,
  type WebhookDeadLetter,
  type WebhookDelivery,
  type WebhookSubscription,
} from "@/redux/webhooksApi";

const STATUS_TONE: Record<string, SignalTone> = {
  active: "complete",
  paused: "needs-input",
  deleted: "blocked",
};

const DELIVERY_TONE: Record<WebhookDelivery["status"], SignalTone> = {
  delivered: "complete",
  pending: "ready",
  retrying: "needs-input",
  dead_lettered: "overdue",
  replayed: "ready",
};

/** A signing secret as create or rotate answered it, beside the endpoint it signs for. */
export interface ShownSecret {
  endpoint: string;
  value: string;
}

function failure(title: string, caught: unknown): Omit<ToastItem, "id"> {
  return { title, detail: describeError(apiError(caught)), tone: "error" };
}

/**
 * Webhook subscriptions for one account (INT-02).
 *
 * The routes existed and nothing read them, so an endpoint could only be
 * registered by an API client calling on its own behalf, and a paused one
 * could only be found in the database. This is the operator's side of that:
 * what is registered, what it listens for, whether XMS is still sending to
 * it, and the deliveries that failed.
 *
 * The signing secret is shown once, on creation and on rotation, and never
 * again. It is not stored anywhere the browser can ask for it, so the panel
 * says plainly that this is the only time it will be readable.
 */
export function AccountWebhooksTab({ accountId }: { accountId: string }) {
  const { data: rows, isLoading } = useAccountWebhooksQuery(accountId);
  const { data: clients } = useApiClientsQuery();
  const { data: eventTypes } = useWebhookEventTypesQuery();
  const { data: deadLetters } = useAccountWebhookDeadLettersQuery({ accountId });
  const [create, creating] = useCreateAccountWebhookMutation();
  const { push } = useToast();

  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<ShownSecret | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const columns: DenseColumn<WebhookSubscription>[] = [
    {
      key: "endpoint",
      title: "Endpoint",
      sortValue: (row) => row.endpoint_url,
      wrap: true,
      render: (row) => <span className="xms-mono text-xms-ink text-body">{row.endpoint_url}</span>,
    },
    { key: "client", title: "Client", sortValue: (row) => row.client.name, render: (row) => row.client.name },
    {
      key: "events",
      title: "Listens for",
      wrap: true,
      render: (row) => <span className="text-xms-body text-body">{eventsLabel(row.event_types)}</span>,
    },
    {
      key: "status",
      title: "Status",
      width: "180px",
      sortValue: (row) => row.status,
      render: (row) => (
        <span className="flex flex-col gap-1">
          <SignalPill tone={STATUS_TONE[row.status] ?? "ready"} label={row.status} />
          {pausedLine(row) ? <span className="text-xms-label text-body">{pausedLine(row)}</span> : null}
        </span>
      ),
    },
    { key: "created", title: "Registered", width: "130px", mono: true, render: (row) => formatDate(row.created_at) },
    {
      key: "actions",
      title: "",
      width: "300px",
      render: (row) => (
        <SubscriptionActions
          accountId={accountId}
          row={row}
          showingDeliveries={open === row.id}
          onToggleDeliveries={() => setOpen(open === row.id ? null : row.id)}
          onRotated={setSecret}
        />
      ),
    },
  ];

  if (isLoading && !rows) return <Skeleton lines={6} />;

  return (
    <div className="flex flex-col gap-4">
      {secret ? <SecretPanel secret={secret} onDismiss={() => setSecret(null)} /> : null}

      <DenseTable<WebhookSubscription>
        title="Webhook endpoints"
        columns={columns}
        rows={rows ?? []}
        rowKey={(row) => row.id}
        emptyState="No endpoint is registered for this account."
        actions={
          <button type="button" className={PRIMARY_BUTTON} onClick={() => setAdding((was) => !was)}>
            {adding ? "Close" : "Register an endpoint"}
          </button>
        }
      />

      {adding ? (
        <NewSubscription
          clients={eligibleClients(clients ?? [], accountId)}
          eventTypes={eventTypes ?? []}
          pending={creating.isLoading}
          onCancel={() => setAdding(false)}
          onCreate={async (body) => {
            try {
              const made = await create({ accountId, body }).unwrap();
              setSecret({ endpoint: made.endpoint_url, value: made.secret });
              setAdding(false);
            } catch (caught) {
              push(failure("The endpoint was not registered", caught));
            }
          }}
        />
      ) : null}

      {open ? <Deliveries accountId={accountId} subscriptionId={open} /> : null}

      {deadLetters && deadLetters.length > 0 ? (
        <DeadLettersPanel accountId={accountId} deadLetters={deadLetters} />
      ) : null}
    </div>
  );
}

export interface SecretPanelProps {
  secret: ShownSecret;
  onDismiss: () => void;
}

function SecretPanel({ secret, onDismiss }: SecretPanelProps) {
  return (
    <Panel
      title="The signing secret"
      subtitle="Copy it now. It is stored sealed and this is the only time it can be read."
    >
      <p className="text-xms-label text-body">{secret.endpoint}</p>
      <p className="xms-field border-xms-line xms-mono text-xms-ink mt-2 rounded-control border px-3 py-2 text-body break-all">
        {secret.value}
      </p>
      <button type="button" className={cn(SECONDARY_BUTTON, "mt-3")} onClick={onDismiss}>
        I have copied it
      </button>
    </Panel>
  );
}

export interface SubscriptionActionsProps {
  accountId: string;
  row: WebhookSubscription;
  showingDeliveries: boolean;
  onToggleDeliveries: () => void;
  onRotated: (secret: ShownSecret) => void;
}

/** One endpoint's row actions: its deliveries, pause or resume, a new secret, and removal. */
function SubscriptionActions({
  accountId,
  row,
  showingDeliveries,
  onToggleDeliveries,
  onRotated,
}: SubscriptionActionsProps) {
  const [pause] = usePauseAccountWebhookMutation();
  const [resume] = useResumeAccountWebhookMutation();
  const [rotate] = useRotateAccountWebhookSecretMutation();
  const [remove] = useDeleteAccountWebhookMutation();
  const { push } = useToast();
  const target = { accountId, id: row.id };

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" className={SECONDARY_BUTTON} onClick={onToggleDeliveries}>
        {showingDeliveries ? "Hide deliveries" : "Deliveries"}
      </button>
      {row.status === "paused" ? (
        <button
          type="button"
          className={SECONDARY_BUTTON}
          onClick={async () => {
            try {
              await resume(target).unwrap();
              push({ title: "Sending resumed", tone: "success" });
            } catch (caught) {
              push(failure("It was not resumed", caught));
            }
          }}
        >
          Resume
        </button>
      ) : (
        <button
          type="button"
          className={SECONDARY_BUTTON}
          onClick={async () => {
            try {
              await pause({ ...target, reason: "Paused by an administrator" }).unwrap();
              push({ title: "Sending paused", tone: "info" });
            } catch (caught) {
              push(failure("It was not paused", caught));
            }
          }}
        >
          Pause
        </button>
      )}
      <ConfirmButton
        label="Rotate secret"
        onConfirm={async () => {
          try {
            const next = await rotate(target).unwrap();
            onRotated({ endpoint: row.endpoint_url, value: next.secret });
          } catch (caught) {
            push(failure("The secret was not rotated", caught));
          }
        }}
      />
      <ConfirmButton
        label="Remove"
        danger
        onConfirm={async () => {
          try {
            await remove(target).unwrap();
            push({ title: "Endpoint removed", tone: "success" });
          } catch (caught) {
            push(failure("It was not removed", caught));
          }
        }}
      />
    </span>
  );
}

/** The deliveries XMS gave up on, each of which can be sent again. */
function DeadLettersPanel({ accountId, deadLetters }: { accountId: string; deadLetters: WebhookDeadLetter[] }) {
  const [replay] = useReplayAccountWebhookMutation();
  const { push } = useToast();

  return (
    <Panel
      title="Dead letters"
      subtitle="Deliveries XMS gave up on. Replaying one sends the same event again, to the endpoint as it stands now."
      flush
    >
      <DenseTable<WebhookDeadLetter>
        title="Dead letters"
        titleHidden
        columns={[
          { key: "event", title: "Event", render: (row) => row.event_type },
          {
            key: "endpoint",
            title: "Endpoint",
            wrap: true,
            render: (row) => <span className="xms-mono text-body">{row.endpoint_url}</span>,
          },
          {
            key: "first",
            title: "First failed",
            width: "140px",
            mono: true,
            render: (row) => formatDate(row.first_failed_at),
          },
          {
            key: "attempts",
            title: "Attempts",
            width: "90px",
            align: "right",
            mono: true,
            render: (row) => row.attempt,
          },
          {
            key: "error",
            title: "Last error",
            wrap: true,
            render: (row) => <span className="text-xms-label text-body">{lastErrorLine(row)}</span>,
          },
          {
            key: "replay",
            title: "",
            width: "110px",
            render: (row) => (
              <ConfirmButton
                label="Replay"
                onConfirm={async () => {
                  try {
                    await replay({ accountId, deliveryId: row.id }).unwrap();
                    push({ title: "Sent again", tone: "success" });
                  } catch (caught) {
                    push(failure("It was not replayed", caught));
                  }
                }}
              />
            ),
          },
        ]}
        rows={deadLetters}
        rowKey={(row) => row.id}
      />
    </Panel>
  );
}

/** The deliveries of one endpoint, newest first, as the API returns them. */
function Deliveries({ accountId, subscriptionId }: { accountId: string; subscriptionId: string }) {
  const { data, isLoading } = useAccountWebhookDeliveriesQuery({ accountId, id: subscriptionId });
  if (isLoading && !data) return <Skeleton lines={4} />;
  return (
    <DenseTable<WebhookDelivery>
      title="Deliveries"
      columns={[
        { key: "event", title: "Event", render: (row) => row.event_type },
        {
          key: "status",
          title: "Outcome",
          width: "150px",
          render: (row) => <SignalPill tone={DELIVERY_TONE[row.status] ?? "ready"} label={row.status} />,
        },
        { key: "attempt", title: "Attempt", width: "90px", align: "right", mono: true, render: (row) => row.attempt },
        {
          key: "response",
          title: "Response",
          width: "110px",
          mono: true,
          render: (row) => (row.response_status === null ? "none" : String(row.response_status)),
        },
        {
          key: "duration",
          title: "Took",
          width: "90px",
          align: "right",
          mono: true,
          render: (row) => (row.duration_ms === null ? "" : `${row.duration_ms} ms`),
        },
        {
          key: "error",
          title: "Error",
          wrap: true,
          render: (row) => <span className="text-xms-label text-body">{row.error ?? ""}</span>,
        },
        { key: "at", title: "When", width: "140px", mono: true, render: (row) => formatDate(row.created_at) },
      ]}
      rows={data ?? []}
      rowKey={(row) => row.id}
      emptyState="Nothing has been sent to this endpoint yet."
    />
  );
}

export interface NewSubscriptionProps {
  clients: { id: string; name: string }[];
  eventTypes: string[];
  pending: boolean;
  onCreate: (body: { api_client_id: string; endpoint_url: string; event_types: string[] }) => void;
  onCancel: () => void;
}

/**
 * Registering an endpoint. The client is required because a subscription
 * belongs to one: the signature XMS sends is that client's, and an account
 * with no active client granted cannot have an endpoint at all, which the
 * form says rather than offering an empty menu.
 */
function NewSubscription({ clients, eventTypes, pending, onCreate, onCancel }: NewSubscriptionProps) {
  const [client, setClient] = useState("");
  const [url, setUrl] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);

  if (clients.length === 0) {
    return (
      <EmptyBanner
        title="No API client to send as"
        detail="A webhook is sent as one of this account's API clients, and it is that client's secret that signs it. Create one on the API clients screen first."
      />
    );
  }

  const valid = client !== "" && url.trim() !== "" && chosen.length > 0;

  return (
    <Panel title="Register an endpoint" subtitle="XMS will POST to it, signed with a secret shown once.">
      <form
        className="flex flex-col gap-3 text-body"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          onCreate({ api_client_id: client, endpoint_url: url.trim(), event_types: chosen });
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xms-label">Send as</span>
            <select
              aria-label="Send as"
              value={client}
              onChange={(event) => setClient(event.target.value)}
              className={cn(INPUT, "w-[240px]")}
            >
              <option value="">Choose a client</option>
              {clients.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[320px] flex-1 flex-col gap-1">
            <span className="text-xms-label">Endpoint</span>
            <input
              aria-label="Endpoint"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/hooks/xms"
              maxLength={2000}
              className={cn(INPUT, "xms-mono max-w-none")}
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xms-label">
            Listens for {chosen.length > 0 ? `(${chosen.length} of at most 20)` : "(at least one)"}
          </legend>
          <div className="flex flex-wrap gap-x-5 gap-y-[6px]">
            {eventTypes.map((type) => (
              <label key={type} className="text-xms-ink flex items-center gap-2 text-body">
                <input
                  type="checkbox"
                  checked={chosen.includes(type)}
                  onChange={(event) =>
                    setChosen((current) =>
                      event.target.checked ? [...current, type] : current.filter((entry) => entry !== type),
                    )
                  }
                />
                <span className="xms-mono">{type}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex gap-2">
          <button type="submit" disabled={!valid || pending} className={PRIMARY_BUTTON}>
            Register
          </button>
          <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}
