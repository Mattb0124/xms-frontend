"use client";

import { useMemo, useState } from "react";
import {
  ConfirmButton,
  FieldRow,
  INPUT,
  InlineError,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from "@/components/admin/primitives";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import {
  accountLabel,
  API_CLIENT_STATUS,
  apiClientBody,
  apiClientError,
  DEFAULT_RATE_LIMIT,
  describeApiClientError,
  emptyApiClientDraft,
  expiryLabel,
  lastUsedLabel,
  rateLimitLabel,
  toggle,
  validateApiClient,
  type ApiClientDraft,
} from "@/lib/integrations/api-clients";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import { useListAccountsQuery } from "@/redux/adminApi";
import {
  useApiClientScopesQuery,
  useApiClientsQuery,
  useCreateApiClientMutation,
  useRevokeApiClientMutation,
  type ApiClient,
  type ApiScope,
} from "@/redux/apiClientsApi";
import { useMe } from "@/redux/me";

const HEAD = "text-xms-ink px-3 py-2 text-left text-body font-semibold whitespace-nowrap";

const CELL = "text-xms-ink px-3 py-2 align-top text-body";

const SMALL = "h-[26px] px-2 text-body";

export function ApiClientStatusPill({ status }: { status: ApiClient["status"] }) {
  const { label, tone } = API_CLIENT_STATUS[status];
  return <SignalPill tone={tone} label={label} />;
}

/** The scopes as chips, in the order the client was granted them. */
function ScopeChips({ scopes }: { scopes: string[] }) {
  if (scopes.length === 0) return <span className="text-xms-label text-body">No scope</span>;
  return (
    <span className="flex flex-wrap gap-1" data-scopes>
      {scopes.map((scope) => (
        <span
          key={scope}
          className="border-xms-line text-xms-body xms-mono rounded-pill border px-2 py-[1px] text-body"
        >
          {scope}
        </span>
      ))}
    </span>
  );
}

/**
 * The key, once. The API never returns it again, so the box stays until it
 * is dismissed by hand and says so in as many words.
 */
export function NewKeyPanel({ name, apiKey, onDismiss }: { name: string; apiKey: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Panel
      title={`Key for ${name}`}
      caption="Shown once"
      actions={
        <button type="button" className={cn(SECONDARY_BUTTON, SMALL)} onClick={onDismiss}>
          I have stored it
        </button>
      }
    >
      <div className="flex flex-col gap-2" data-testid="new-api-key">
        <p className="text-body text-[color:var(--state-needs-input-text)]">
          Copy this key now. It will not be shown again, and it cannot be recovered. Issue a new client if it is lost.
        </p>
        <div className="flex items-center gap-2">
          <code
            className="border-xms-line bg-xms-tint text-xms-ink xms-mono flex-1 overflow-x-auto rounded-control border px-2 py-2 text-body"
            data-api-key
          >
            {apiKey}
          </code>
          <button
            type="button"
            className={cn(SECONDARY_BUTTON, SMALL)}
            onClick={() => {
              void navigator.clipboard?.writeText(apiKey);
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

export interface NewClientFormProps {
  draft: ApiClientDraft;
  onChange: (patch: Partial<ApiClientDraft>) => void;
  onSubmit: () => Promise<void>;
  error: string | null;
  creating: boolean;
  /** The server's scope catalog; undefined until it has answered. */
  scopes: ApiScope[] | undefined;
  loadingScopes: boolean;
  /** The accounts granted to the viewer, the only ones a client can be given. */
  accountIds: string[];
  accountNames: Record<string, string>;
}

function NewClientForm({
  draft,
  onChange,
  onSubmit,
  error,
  creating,
  scopes,
  loadingScopes,
  accountIds,
  accountNames,
}: NewClientFormProps) {
  return (
    <Panel title="New client" caption="The key is shown once when the client is created">
      <form
        className="flex flex-col gap-3"
        aria-label="New API client"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <FieldRow label="Name" htmlFor="client-name">
          <input
            id="client-name"
            maxLength={120}
            className={INPUT}
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </FieldRow>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-xms-label text-body">Scopes</legend>
          {loadingScopes && !scopes ? <Skeleton lines={3} /> : null}
          {(scopes ?? []).map((scope) => (
            <label key={scope.scope} className="flex items-start gap-2 text-body">
              <input
                type="checkbox"
                className="mt-[3px]"
                checked={draft.scopes.includes(scope.scope)}
                onChange={() => onChange({ scopes: toggle(draft.scopes, scope.scope) })}
              />
              <span>
                <span className="xms-mono text-xms-ink">{scope.scope}</span>
                {scope.description ? <span className="text-xms-label"> {scope.description}</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-xms-label text-body">Accounts</legend>
          {accountIds.length === 0 ? (
            <p className="text-xms-label text-body">You have no granted accounts to give this client.</p>
          ) : null}
          {accountIds.map((id) => (
            <label key={id} className="flex items-center gap-2 text-body">
              <input
                type="checkbox"
                checked={draft.accountIds.includes(id)}
                onChange={() => onChange({ accountIds: toggle(draft.accountIds, id) })}
              />
              <span className={cn(accountNames[id] ? "text-xms-ink" : "xms-mono text-xms-body")}>
                {accountLabel(id, accountNames)}
              </span>
            </label>
          ))}
        </fieldset>
        <FieldRow label="Expires" htmlFor="client-expiry">
          <input
            id="client-expiry"
            type="date"
            className={cn(INPUT, "xms-mono")}
            value={draft.expiresOn}
            onChange={(event) => onChange({ expiresOn: event.target.value })}
          />
        </FieldRow>
        <p className="text-xms-label text-body">Leave the expiry empty for a key that does not expire.</p>
        <FieldRow label="Rate limit (requests a minute)" htmlFor="client-rate">
          <input
            id="client-rate"
            inputMode="numeric"
            className={cn(INPUT, "xms-mono w-[130px]")}
            value={draft.ratePerMinute}
            onChange={(event) => onChange({ ratePerMinute: event.target.value })}
          />
        </FieldRow>
        <p className="text-xms-label text-body">
          The API throttles this client past its limit. It is per client, not per account, and {DEFAULT_RATE_LIMIT} a
          minute is what a key carries unless you change it here.
        </p>
        <InlineError message={error} />
        <div>
          <button type="submit" className={PRIMARY_BUTTON} disabled={creating}>
            Create client
          </button>
        </div>
      </form>
    </Panel>
  );
}

export interface ClientsTableProps {
  /** Undefined until the list has answered. */
  clients: ApiClient[] | undefined;
  loading: boolean;
  failed: boolean;
}

/** Every client, active and revoked, with Revoke behind a confirm on the active ones. */
function ClientsTable({ clients, loading, failed }: ClientsTableProps) {
  const [revoke, { isLoading: revoking }] = useRevokeApiClientMutation();
  const { push } = useToast();
  const trackRevoke = useTrack("api_client.revoke");

  const revokeClient = async (client: ApiClient) => {
    try {
      await revoke(client.id).unwrap();
      trackRevoke({ client_id: client.id });
      push({ title: "Client revoked", detail: `${client.name} can no longer call the API.`, tone: "success" });
    } catch (caught) {
      push({ title: "Not revoked", detail: describeApiClientError(apiClientError(caught)), tone: "error" });
    }
  };

  return (
    <Panel title="Clients" caption="Active and revoked" flush>
      {loading && !clients ? (
        <div className="p-4">
          <Skeleton lines={3} />
        </div>
      ) : null}
      {failed ? <p className="text-xms-muted p-4 text-body">The API clients could not be loaded.</p> : null}
      {clients ? (
        <table className="w-full border-collapse" aria-label="API clients">
          <thead className="bg-xms-card">
            <tr className="border-xms-line border-b">
              <th className={HEAD}>Name</th>
              <th className={HEAD}>Key prefix</th>
              <th className={HEAD}>Scopes</th>
              <th className={HEAD}>Accounts</th>
              <th className={HEAD}>Rate limit</th>
              <th className={HEAD}>Last used</th>
              <th className={HEAD}>Status</th>
              <th className={cn(HEAD, "text-right")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr
                key={client.id}
                className="border-xms-line border-b align-top"
                data-client={client.id}
                data-status={client.status}
              >
                <td className={CELL}>
                  <span className="xms-stack">
                    <span className="text-xms-ink font-medium">{client.name}</span>
                    <span className="text-xms-label text-body">{expiryLabel(client.expires_at)}</span>
                  </span>
                </td>
                <td className={cn(CELL, "xms-mono text-xms-body text-body")} data-key-prefix>
                  {client.key_prefix}
                </td>
                <td className={CELL}>
                  <ScopeChips scopes={client.scopes} />
                </td>
                <td className={CELL} data-accounts>
                  {client.account_ids.length} account{client.account_ids.length === 1 ? "" : "s"}
                </td>
                <td className={cn(CELL, "xms-mono text-xms-body text-body")} data-rate-limit>
                  {rateLimitLabel(client.rate_limit_per_minute)}
                </td>
                <td className={cn(CELL, "xms-mono text-xms-label text-body")}>{lastUsedLabel(client.last_used_at)}</td>
                <td className={CELL}>
                  <ApiClientStatusPill status={client.status} />
                </td>
                <td className={cn(CELL, "text-right")}>
                  {client.status === "active" ? (
                    <ConfirmButton
                      label="Revoke"
                      danger
                      disabled={revoking}
                      className={SMALL}
                      onConfirm={() => revokeClient(client)}
                    />
                  ) : (
                    <span className="text-xms-label text-body">Revoked</span>
                  )}
                </td>
              </tr>
            ))}
            {clients.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-xms-label px-4 py-8 text-center text-body">
                  No API client issued yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}
    </Panel>
  );
}

/** The New client form: whether it is open, the draft, the refusal, and the key the last create returned. */
function useNewClient() {
  const [create, { isLoading: creating }] = useCreateApiClientMutation();
  const trackCreate = useTrack("api_client.create");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ApiClientDraft>(emptyApiClientDraft);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ name: string; key: string } | null>(null);

  const toggleOpen = () => {
    setError(null);
    setOpen(!open);
  };

  const set = (patch: Partial<ApiClientDraft>) => setDraft((previous) => ({ ...previous, ...patch }));

  const submit = async () => {
    const problem = validateApiClient(draft);
    setError(problem);
    if (problem) return;
    try {
      const created = await create(apiClientBody(draft)).unwrap();
      trackCreate({ client_id: created.id, scopes: created.scopes.length, accounts: draft.accountIds.length });
      setFresh({ name: created.name, key: created.key });
      setDraft(emptyApiClientDraft);
      setOpen(false);
    } catch (caught) {
      setError(describeApiClientError(apiClientError(caught)));
    }
  };

  return { open, toggleOpen, draft, set, error, creating, submit, fresh, dismissKey: () => setFresh(null) };
}

/**
 * API clients (Accounts & Administration functional 5.9, Integrations
 * functional 5.4): the list with the key prefix, the scopes, how many
 * accounts the client may read, the rate limit it carries, last used and the
 * status; a New client form over the server's scope catalog and the accounts
 * granted to the viewer, opening on the API's own default rate limit;
 * and Revoke behind a confirm. Needs `admin:api-clients`, which
 * `admin:users` implies; fails closed and never asks the API without it.
 */
export function ApiClientsView() {
  const me = useMe();
  const allowed = me.hasPermission("admin:api-clients");
  const canReadAccounts = me.hasPermission("admin:accounts");
  const clients = useApiClientsQuery(undefined, { skip: !allowed });
  const scopes = useApiClientScopesQuery(undefined, { skip: !allowed });
  const accounts = useListAccountsQuery(undefined, { skip: !allowed || !canReadAccounts });
  const form = useNewClient();

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const account of accounts.data ?? []) map[account.id] = account.name;
    return map;
  }, [accounts.data]);

  if (!me.permissions) return <Skeleton lines={4} className="max-w-md" />;
  if (!allowed) {
    return (
      <EmptyBanner
        title="Not permitted"
        detail="API clients need the admin:api-clients permission, which admin:users implies."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="api-clients">
      {form.fresh ? <NewKeyPanel name={form.fresh.name} apiKey={form.fresh.key} onDismiss={form.dismissKey} /> : null}
      <Panel
        title="API clients"
        caption="One key per organization or system, scoped and granted accounts"
        actions={
          <button
            type="button"
            className={cn(form.open ? SECONDARY_BUTTON : PRIMARY_BUTTON, SMALL)}
            onClick={form.toggleOpen}
          >
            {form.open ? "Cancel" : "New client"}
          </button>
        }
      >
        <p className="text-xms-label text-body">
          Webhook subscriptions are not registered here. A client with the webhooks:manage scope registers its own
          endpoints through the API with its key, and receives the signing secret once in the same way.
        </p>
      </Panel>
      {form.open ? (
        <NewClientForm
          draft={form.draft}
          onChange={form.set}
          onSubmit={form.submit}
          error={form.error}
          creating={form.creating}
          scopes={scopes.data}
          loadingScopes={scopes.isLoading}
          accountIds={me.grantedAccounts}
          accountNames={names}
        />
      ) : null}
      <ClientsTable clients={clients.data} loading={clients.isLoading} failed={clients.isError} />
    </div>
  );
}
