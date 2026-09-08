"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PeriodSwitcher } from "@/components/reporting/period-switcher";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { ScoreTile } from "@/components/xms/score-tile";
import { Skeleton } from "@/components/xms/skeleton";
import { useMe } from "@/redux/me";
import { useSecurityDashboardQuery, type SecurityDashboard as SecurityData } from "@/redux/reportingApi";

interface Count {
  label: string;
  detail?: string;
  n: number;
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
          <span className="xms-mono text-xms-ink ml-auto font-semibold">{row.n}</span>
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
  webhook: "Webhook subscription",
  connector: "Connector instance",
};

/** The pause reason as the server keeps it; "unstated" is the server's own word for a pause with no reason. */
function pausedLabel(kind: string): string {
  return PAUSED_KIND[kind] ?? kind;
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
  // The connector list rather than one record: the API counts tripped
  // instances and open dead letters by reason and by queue, not by instance,
  // so there is no id to address. The list carries the Tripped pill and each
  // record its own Dead letters tab.
  const connectorsHref = me.hasPermission("admin:connectors") ? "/admin/connectors" : undefined;

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
      paused: total(data.paused_integrations),
      quarantined: total(data.quarantined_attachments),
      deadLetters: total(data.open_dead_letters),
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
        label: pausedLabel(row.kind),
        detail: row.reason,
        n: row.n,
        // Webhook subscriptions are registered by the client itself through
        // the API with its key, so this application serves no screen for
        // them and the row carries no link.
        href: row.kind === "connector" ? connectorsHref : undefined,
      })),
    [data, connectorsHref],
  );
  const deadLetterRows = useMemo(
    () =>
      (data?.open_dead_letters ?? []).map((row) => ({
        label: row.queue,
        detail: `oldest ${row.oldest.slice(0, 10)}`,
        n: row.n,
        href: connectorsHref,
      })),
    [data, connectorsHref],
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
            <ScoreTile label="Sign-in failures" value={tiles.signin} tone={tiles.signin > 0 ? "warn" : "good"} />
            <ScoreTile label="Denials" value={tiles.denials} tone={tiles.denials > 0 ? "warn" : "good"} />
            <ScoreTile label="Isolation probes" value={tiles.probes} tone={tiles.probes > 0 ? "breach" : "good"} />
            <ScoreTile label="Admin changes" value={tiles.admin} />
            <ScoreTile label="Exports and downloads" value={tiles.exports} />
            <ScoreTile label="Abuse events" value={tiles.abuse} tone={tiles.abuse > 0 ? "warn" : "good"} />
            {data.rate_limited_clients ? (
              <ScoreTile
                label="Rate limited clients"
                value={tiles.rateLimited}
                tone={tiles.rateLimited > 0 ? "warn" : "good"}
                href={apiClientsHref}
              />
            ) : null}
            {data.paused_integrations ? (
              <ScoreTile
                label="Paused integrations"
                detail="Right now, not over the window"
                value={tiles.paused}
                tone={tiles.paused > 0 ? "warn" : "good"}
              />
            ) : null}
            {data.quarantined_attachments ? (
              <ScoreTile
                label="Quarantined files"
                value={tiles.quarantined}
                tone={tiles.quarantined > 0 ? "breach" : "good"}
              />
            ) : null}
            {data.open_dead_letters ? (
              <ScoreTile
                label="Open dead letters"
                detail="Right now, not over the window"
                value={tiles.deadLetters}
                tone={tiles.deadLetters > 0 ? "warn" : "good"}
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
                subtitle="What is paused right now, by reason, not what paused during the window."
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
                subtitle="The backlog as it stands, with the oldest failure in each queue."
              >
                <CountList rows={deadLetterRows} empty="No open dead letters." />
              </Panel>
            ) : null}
            <Panel title="Integrity" caption="Daily digest and verification">
              <p className="text-xms-label text-[13px]">
                The digest job is not scheduled yet. Last digest and last verification will appear here once it runs.
              </p>
            </Panel>
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
