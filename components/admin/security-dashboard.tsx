"use client";

import Link from "next/link";
import { formatDay } from "@/lib/format/date";
import { useMemo, useState } from "react";
import { IntegrityPanel } from "@/components/admin/integrity-panel";
import { PeriodSwitcher } from "@/components/reporting/period-switcher";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { ScoreTile } from "@/components/xms/score-tile";
import { Skeleton } from "@/components/xms/skeleton";
import { useMe } from "@/redux/me";
import {
  useSecurityDashboardQuery,
  type OpenDeadLetter,
  type PausedIntegration,
  type SecurityDashboard as SecurityData,
} from "@/redux/reportingApi";

interface Count {
  label: string;
  detail?: string;
  /** A row that names a record rather than counting one carries no number. */
  n?: number;
  /** The screen this row is answered on, where this application serves one. */
  href?: string;
}

/** A dense list of counts with the mono number on the right; a row with a screen behind it links to it. */
export function CountList({ rows, empty }: { rows: Count[]; empty: string }) {
  if (rows.length === 0) return <p className="text-xms-label text-[13px]">{empty}</p>;
  return (
    <ul className="flex flex-col">
      {rows.map((row, index) => (
        <li
          key={`${row.label}-${index}`}
          className="border-xms-line flex items-center gap-3 border-b py-2 text-[13px] last:border-b-0"
        >
          {row.href ? (
            <Link href={row.href} className="xms-mono text-xms-accent truncate hover:underline">
              {row.label}
            </Link>
          ) : (
            <span className="xms-mono text-xms-ink truncate">{row.label}</span>
          )}
          {row.detail ? <span className="xms-mono text-xms-muted text-[11px]">{row.detail}</span> : null}
          {row.n === undefined ? null : <span className="xms-mono text-xms-ink ml-auto font-semibold">{row.n}</span>}
        </li>
      ))}
    </ul>
  );
}

function sumWhere(data: SecurityData, predicate: (row: SecurityData["by_type"][number]) => boolean): number {
  return data.by_type.filter(predicate).reduce((total, row) => total + row.n, 0);
}

function total(rows: { n: number }[] | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + row.n, 0);
}

const PAUSED_KIND: Record<string, string> = {
  webhook_subscription: "Webhook subscription",
  connector_instance: "Connector instance",
};

export function pausedKindLabel(kind: string): string {
  return PAUSED_KIND[kind] ?? kind.replace(/_/g, " ");
}

/**
 * What a paused row says beside its name: the kind, the account it is under
 * and the reason the server recorded. "unstated" is the server's own word
 * for a pause with no reason, and is left as it wrote it.
 */
export function pausedDetail(row: PausedIntegration): string {
  return [pausedKindLabel(row.kind), row.account_key, row.reason].filter(Boolean).join(", ");
}

/** The oldest failure and, for a connector queue, the instance it belongs to. */
export function deadLetterDetail(row: OpenDeadLetter): string {
  const oldest = `oldest ${formatDay(row.oldest)}`;
  return row.instance_name ? `${row.instance_name}, ${oldest}` : oldest;
}

/**
 * Security dashboard (Audit & Analytics 7.1, P2.19.4, XA-03): sign-in
 * failures, denials by route, isolation probes by actor, admin changes,
 * exports and downloads, the abuse half of the stream with the clients the
 * rate limiter turned away, what is paused right now, the files the scanner
 * held back, the open dead letters, and an integrity placeholder until the
 * digest job lands.
 *
 * A figure the API did not send is left out, tile and panel both: a zero
 * would read as "nothing happened", which is not what an older API said.
 * Where this application serves the screen that answers a row, the row links
 * to it, and only for a reader who may open it.
 */
export function SecurityDashboard() {
  const me = useMe();
  const [days, setDays] = useState(7);
  const { data, isLoading, isError, refetch } = useSecurityDashboardQuery({ days });
  // The Admin screens these rows are answered on. A link the reader would be
  // refused is worse than none, so each is offered only with its permission
  // in hand; the browser decides nothing else here.
  const apiClientsHref = me.hasPermission("admin:api-clients") ? "/admin/api-clients" : undefined;
  // The API names the record behind each paused integration and each open
  // dead letter now (backend 77745ef), so a row opens the record rather than
  // a list to go looking in: a tripped instance opens its own connector page,
  // a dead-letter queue opens that instance's Dead letters tab, and a paused
  // webhook subscription opens the account it belongs to, this application
  // serving no screen for a subscription the client registers itself.
  const connectors = me.hasPermission("admin:connectors");
  const accounts = me.hasPermission("admin:accounts");
  const connectorsHref = connectors ? "/admin/connectors" : undefined;

  const tiles = useMemo(() => {
    if (!data) return null;
    return {
      signin: sumWhere(data, (row) => row.event_type === "auth.signin.failed"),
      denials: sumWhere(data, (row) => row.event_type.startsWith("authz.") && row.outcome === "denied"),
      probes: data.isolation_probes.reduce((sum, row) => sum + row.n, 0),
      admin: sumWhere(data, (row) => row.event_type.startsWith("admin.")),
      exports: sumWhere(
        data,
        (row) => row.event_type.startsWith("data.export") || row.event_type.startsWith("data.download"),
      ),
      // The abuse group as its own list where the API sends it, and the same
      // group counted out of by_type where it does not.
      abuse: data.abuse_by_kind
        ? total(data.abuse_by_kind)
        : sumWhere(data, (row) => row.event_type.startsWith("abuse.")),
      rateLimited: total(data.rate_limited_clients),
      // The tiles read the roll-ups the API sends beside the lists: the
      // paused count is by reason, and the dead-letter depth is the
      // operator-wide one per queue, which is deliberately wider than the
      // rows a reader bound to some accounts is shown.
      paused: total(data.paused_integrations_by_reason),
      quarantined: total(data.quarantined_attachments),
      deadLetters: total(data.open_dead_letters_by_queue),
    };
  }, [data]);

  const rateLimitedRows = useMemo(
    () =>
      (data?.rate_limited_clients ?? []).map((row) => ({
        label: row.actor_id,
        detail: row.principal_kind ?? undefined,
        n: row.n,
        href: apiClientsHref,
      })),
    [data, apiClientsHref],
  );
  const pausedRows = useMemo(
    () =>
      (data?.paused_integrations ?? []).map((row) => ({
        label: row.name || pausedKindLabel(row.kind),
        detail: pausedDetail(row),
        // One row is one paused thing, so there is nothing to count here.
        // A row that names no record carries no link: an address built from a
        // missing id opens nothing and says the row was addressable.
        href:
          row.kind === "connector_instance"
            ? connectors && row.id
              ? `/admin/connectors/${row.id}`
              : undefined
            : accounts && row.account_id
              ? `/admin/accounts/${row.account_id}`
              : undefined,
      })),
    [data, connectors, accounts],
  );
  const deadLetterRows = useMemo(
    () =>
      (data?.open_dead_letters ?? []).map((row) => ({
        label: row.queue,
        detail: deadLetterDetail(row),
        n: row.n,
        // The instance's own Dead letters tab, which is where the work is
        // replayed or discarded. A platform queue names no instance, and
        // there is no screen that replays it, so the row carries no link.
        href: row.instance_id && connectors ? `/admin/connectors/${row.instance_id}?tab=dead-letters` : undefined,
      })),
    [data, connectors],
  );

  const denialRows = useMemo(
    () =>
      (data?.by_type ?? [])
        .filter((row) => row.event_type.startsWith("authz.") && row.outcome === "denied")
        .map((row) => ({ label: row.event_type, n: row.n })),
    [data],
  );
  const adminRows = useMemo(
    () =>
      (data?.by_type ?? [])
        .filter((row) => row.event_type.startsWith("admin."))
        .map((row) => ({ label: row.event_type, detail: row.outcome, n: row.n })),
    [data],
  );
  const exportRows = useMemo(
    () =>
      (data?.by_type ?? [])
        .filter((row) => row.event_type.startsWith("data."))
        .map((row) => ({ label: row.event_type, detail: row.outcome, n: row.n })),
    [data],
  );

  return (
    <div className="flex flex-col gap-4" data-testid="security-dashboard">
      <HeaderFilters>
        <PeriodSwitcher value={days} onChange={setDays} />
      </HeaderFilters>
      {isError ? (
        <EmptyBanner
          title="The security dashboard could not be loaded"
          action={{ label: "Retry", onClick: () => void refetch() }}
        />
      ) : null}
      {isLoading && !data ? <Skeleton lines={8} /> : null}
      {data && tiles ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-testid="security-tiles">
            <ScoreTile label="Sign-in failures" value={tiles.signin} />
            <ScoreTile label="Denials" value={tiles.denials} />
            <ScoreTile label="Isolation probes" value={tiles.probes} />
            <ScoreTile label="Admin changes" value={tiles.admin} />
            <ScoreTile label="Exports and downloads" value={tiles.exports} />
            <ScoreTile label="Abuse events" value={tiles.abuse} />
            {data.rate_limited_clients ? (
              <ScoreTile label="Rate limited clients" value={tiles.rateLimited} href={apiClientsHref} />
            ) : null}
            {data.paused_integrations_by_reason ? (
              <ScoreTile label="Paused integrations" detail="Right now, not over the window" value={tiles.paused} />
            ) : null}
            {data.quarantined_attachments ? <ScoreTile label="Quarantined files" value={tiles.quarantined} /> : null}
            {data.open_dead_letters_by_queue ? (
              <ScoreTile
                label="Open dead letters"
                detail="Right now, not over the window"
                value={tiles.deadLetters}
                href={connectorsHref}
              />
            ) : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Sign-in failures" caption="By user and IP hash">
              <CountList
                rows={data.signin_failures.map((row) => ({
                  label: row.actor_id,
                  detail: row.ip_hash ?? undefined,
                  n: row.n,
                }))}
                empty="No failed sign-ins in the period."
              />
            </Panel>
            <Panel title="Isolation probes" caption="By actor, the top signal for a curious account">
              <CountList
                rows={data.isolation_probes.map((row) => ({ label: row.actor_id, n: row.n }))}
                empty="No isolation-filtered requests in the period."
              />
            </Panel>
            <Panel title="Denials" caption="Permission, realm and account denials">
              <CountList rows={denialRows} empty="No denials in the period." />
            </Panel>
            <Panel title="Admin changes" caption="Timeline by event type">
              <CountList rows={adminRows} empty="No administrative changes in the period." />
            </Panel>
            <Panel title="Exports and downloads" caption="By event type">
              <CountList rows={exportRows} empty="No exports or downloads in the period." />
            </Panel>
            {data.abuse_by_kind ? (
              <Panel title="Abuse" caption="Rate limits, signatures, loops, uploads, CSP">
                <CountList
                  rows={data.abuse_by_kind.map((row) => ({ label: row.event_type, n: row.n }))}
                  empty="Nothing abusive in the period."
                />
              </Panel>
            ) : null}
            {data.rate_limited_clients ? (
              <Panel
                title="Rate limited clients"
                caption="Who the limiter turned away"
                subtitle="Each row opens the API clients screen."
              >
                <CountList rows={rateLimitedRows} empty="The limiter turned nobody away in the period." />
              </Panel>
            ) : null}
            {data.paused_integrations ? (
              <Panel
                title="Paused integrations"
                caption="Paused subscriptions and tripped instances"
                subtitle="What is paused right now, one row per record, not what paused during the window. A tripped instance opens its own page and a paused subscription the account it belongs to."
              >
                <CountList rows={pausedRows} empty="Nothing is paused." />
              </Panel>
            ) : null}
            {data.quarantined_attachments ? (
              <Panel title="Quarantined files" caption="By where the file came from">
                <CountList
                  rows={data.quarantined_attachments.map((row) => ({ label: row.origin, n: row.n }))}
                  empty="The scanner held nothing back in the period."
                />
              </Panel>
            ) : null}
            {data.open_dead_letters ? (
              <Panel
                title="Open dead letters"
                caption="Queues with work nobody claimed back"
                subtitle="The backlog as it stands, with the oldest failure in each queue. A connector queue opens that instance's Dead letters tab; the tile counts every account, these rows only the ones granted to you."
              >
                <CountList rows={deadLetterRows} empty="No open dead letters." />
              </Panel>
            ) : null}
            {/* The digest chain, the archive, the streams and the retention
                policy, from their own route (backend cecce62). The panel
                draws nothing at all where the API does not answer it, since
                an empty integrity panel would read as nothing protecting
                these events. */}
            <IntegrityPanel />
          </div>
          <Panel title="All security events" caption="By type and outcome">
            <CountList
              rows={data.by_type.map((row) => ({ label: row.event_type, detail: row.outcome, n: row.n }))}
              empty="No security events in the period."
            />
          </Panel>
        </>
      ) : null}
    </div>
  );
}
