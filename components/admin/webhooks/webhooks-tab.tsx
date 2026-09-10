"use client";

import { useMemo, useState } from "react";
import { ConfirmButton, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON, formatDate } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { SignalPill, type SignalTone } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { cn } from "@/lib/utils";
import { useApiClientsQuery, type ApiClient } from "@/redux/apiClientsApi";
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

/**
 * Why the worker stopped sending, in words rather than in its own
 * vocabulary. A subscription paused by a person carries their note instead.
 */
export function pausedLine(row: WebhookSubscription): string {
  if (row.status !== "paused") return "";
  if (row.paused_note) return row.paused_note;
  switch (row.paused_reason) {
    case "consecutive_failures":
      return `Paused by XMS after ${row.consecutive_failures} deliveries in a row failed.`;
    case "endpoint_gone":
      return "Paused by XMS: the endpoint stopped answering at all.";
    case "manual":
      return "Paused by hand.";
    default:
      return row.paused_reason ? `Paused: ${row.paused_reason}.` : "Paused.";
  }
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
  const [pause] = usePauseAccountWebhookMutation();
  const [resume] = useResumeAccountWebhookMutation();
  const [rotate] = useRotateAccountWebhookSecretMutation();
  const [remove] = useDeleteAccountWebhookMutation();
  const [replay] = useReplayAccountWebhookMutation();
  const { push } = useToast();

  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ endpoint: string; value: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // Only the clients granted this account can carry one of its endpoints.
  const eligible = useMemo(
    () =>
      (clients ?? []).filter(
        (client: ApiClient) => client.account_ids.includes(accountId) && client.status === "active",
      ),
    [clients, accountId],
  );

  const failed = (caught: unknown, title: string) =>
    push({ title, detail: describeError(apiError(caught)), tone: "error" });

  const columns: DenseColumn<WebhookSubscription>[] = [
    {
      key: "endpoint",
      title: "Endpoint",
      sortValue: (row) => row.endpoint_url,
      wrap: true,
      render: (row) => <span className="xms-mono text-xms-ink text-[12px]">{row.endpoint_url}</span>,
    },
    { key: "client", title: "Client", sortValue: (row) => row.client.name, render: (row) => row.client.name },
    {
      key: "events",
      title: "Listens for",
      wrap: true,
      render: (row) => (
        <span className="text-xms-body text-[12px]">
          {row.event_types.length} {row.event_types.length === 1 ? "event" : "events"}: {row.event_types.join(", ")}
        </span>
      ),
    },
    {
      key: "status",
      title: "Status",
      width: "180px",
      sortValue: (row) => row.status,
      render: (row) => (
        <span className="flex flex-col gap-1">
          <SignalPill tone={STATUS_TONE[row.status] ?? "ready"} label={row.status} />
          {pausedLine(row) ? <span className="text-xms-label text-[12px]">{pausedLine(row)}</span> : null}
        </span>
      ),
    },
    { key: "created", title: "Registered", width: "130px", mono: true, render: (row) => formatDate(row.created_at) },
    {
      key: "actions",
      title: "",
      width: "300px",
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setOpen(open === row.id ? null : row.id)}>
            {open === row.id ? "Hide deliveries" : "Deliveries"}
          </button>
          {row.status === "paused" ? (
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={async () => {
                try {
                  await resume({ accountId, id: row.id }).unwrap();
                  push({ title: "Sending resumed", tone: "success" });
                } catch (caught) {
                  failed(caught, "It was not resumed");
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
                  await pause({ accountId, id: row.id, reason: "Paused by an administrator" }).unwrap();
                  push({ title: "Sending paused", tone: "info" });
                } catch (caught) {
                  failed(caught, "It was not paused");
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
                const next = await rotate({ accountId, id: row.id }).unwrap();
                setSecret({ endpoint: row.endpoint_url, value: next.secret });
              } catch (caught) {
                failed(caught, "The secret was not rotated");
              }
            }}
          />
          <ConfirmButton
            label="Remove"
            danger
            onConfirm={async () => {
              try {
                await remove({ accountId, id: row.id }).unwrap();
                push({ title: "Endpoint removed", tone: "success" });
              } catch (caught) {
                failed(caught, "It was not removed");
              }
            }}
          />
        </span>
      ),
    },
  ];

  if (isLoading && !rows) return <Skeleton lines={6} />;

  return (
    <div className="flex flex-col gap-4">
      {secret ? (
        <Panel
          title="The signing secret"
          subtitle="Copy it now. It is stored sealed and this is the only time it can be read."
        >
          <p className="text-xms-label text-[12px]">{secret.endpoint}</p>
          <p className="xms-field border-xms-line xms-mono text-xms-ink mt-2 rounded-[4px] border px-3 py-2 text-[13px] break-all">
            {secret.value}
          </p>
          <button type="button" className={cn(SECONDARY_BUTTON, "mt-3")} onClick={() => setSecret(null)}>
            I have copied it
          </button>
        </Panel>
      ) : null}

      <DenseTable<WebhookSubscription>
        title="Webhook endpoints"
        subtitle="where this account's events are sent, and whether XMS is still sending to them"
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
          clients={eligible}
          eventTypes={eventTypes ?? []}
          pending={creating.isLoading}
          onCancel={() => setAdding(false)}
          onCreate={async (body) => {
            try {
              const made = await create({ accountId, body }).unwrap();
              setSecret({ endpoint: made.endpoint_url, value: made.secret });
              setAdding(false);
            } catch (caught) {
              failed(caught, "The endpoint was not registered");
            }
          }}
        />
      ) : null}

      {open ? <Deliveries accountId={accountId} subscriptionId={open} /> : null}

      {deadLetters && deadLetters.length > 0 ? (
        <Panel
          title="Dead letters"
          subtitle="Deliveries XMS gave up on. Replaying one sends the same event again, to the endpoint as it stands now."
          flush
        >
          <DenseTable
            title="Dead letters"
            titleHidden
            columns={[
              { key: "event", title: "Event", render: (row: (typeof deadLetters)[number]) => row.event_type },
              {
                key: "endpoint",
                title: "Endpoint",
                wrap: true,
                render: (row: (typeof deadLetters)[number]) => (
                  <span className="xms-mono text-[12px]">{row.endpoint_url}</span>
                ),
              },
              {
                key: "first",
                title: "First failed",
                width: "140px",
                mono: true,
                render: (row: (typeof deadLetters)[number]) => formatDate(row.first_failed_at),
              },
              {
                key: "attempts",
                title: "Attempts",
                width: "90px",
                align: "right",
                mono: true,
                render: (row: (typeof deadLetters)[number]) => row.attempt,
              },
              {
                key: "error",
                title: "Last error",
                wrap: true,
                render: (row: (typeof deadLetters)[number]) => (
                  <span className="text-xms-label text-[12px]">
                    {row.response_status ? `HTTP ${row.response_status}. ` : ""}
                    {row.error ?? "No response."}
                  </span>
                ),
              },
              {
                key: "replay",
                title: "",
                width: "110px",
                render: (row: (typeof deadLetters)[number]) => (
                  <ConfirmButton
                    label="Replay"
                    onConfirm={async () => {
                      try {
                        await replay({ accountId, deliveryId: row.id }).unwrap();
                        push({ title: "Sent again", tone: "success" });
                      } catch (caught) {
                        failed(caught, "It was not replayed");
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
      ) : null}
    </div>
  );
}

/** The deliveries of one endpoint, newest first, as the API returns them. */
function Deliveries({ accountId, subscriptionId }: { accountId: string; subscriptionId: string }) {
  const { data, isLoading } = useAccountWebhookDeliveriesQuery({ accountId, id: subscriptionId });
  if (isLoading && !data) return <Skeleton lines={4} />;
  return (
    <DenseTable<WebhookDelivery>
      title="Deliveries"
      subtitle="every attempt against this endpoint, with what came back"
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
          render: (row) => <span className="text-xms-label text-[12px]">{row.error ?? ""}</span>,
        },
        { key: "at", title: "When", width: "140px", mono: true, render: (row) => formatDate(row.created_at) },
      ]}
      rows={data ?? []}
      rowKey={(row) => row.id}
      emptyState="Nothing has been sent to this endpoint yet."
    />
  );
}

/**
 * Registering an endpoint. The client is required because a subscription
 * belongs to one: the signature XMS sends is that client's, and an account
 * with no active client granted cannot have an endpoint at all, which the
 * form says rather than offering an empty menu.
 */
function NewSubscription({
  clients,
  eventTypes,
  pending,
  onCreate,
  onCancel,
}: {
  clients: { id: string; name: string }[];
  eventTypes: string[];
  pending: boolean;
  onCreate: (body: { api_client_id: string; endpoint_url: string; event_types: string[] }) => void;
  onCancel: () => void;
}) {
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
        className="flex flex-col gap-3 text-[12px]"
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
              <label key={type} className="text-xms-ink flex items-center gap-2 text-[12px]">
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
