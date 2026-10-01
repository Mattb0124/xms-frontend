"use client";

import { useState } from "react";
import { CountList, type CountRow } from "@/components/admin/count-list";
import { IntegrityPanel } from "@/components/admin/integrity-panel";
import { PeriodSwitcher } from "@/components/reporting/period-switcher";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { ScoreTile } from "@/components/xms/score-tile";
import { Skeleton } from "@/components/xms/skeleton";
import {
  deadLetterDetail,
  deadLetterHref,
  isAdminChange,
  isDataEvent,
  isDenial,
  pausedDetail,
  pausedHref,
  pausedLabel,
  securityLinks,
  securityTiles,
  type SecurityLinks,
} from "@/lib/reporting/security";
import { useMe } from "@/redux/me";
import { useSecurityDashboardQuery, type SecurityDashboard as SecurityData } from "@/redux/reportingApi";

function eventRows(rows: SecurityData["by_type"]): CountRow[] {
  return rows.map((row) => ({
    key: `${row.event_type}:${row.outcome}`,
    label: row.event_type,
    detail: row.outcome,
    n: row.n,
  }));
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
  const links = securityLinks(me.hasPermission);

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
      {data ? (
        <>
          <SecurityTiles data={data} links={links} />
          <div className="grid gap-4 lg:grid-cols-2">
            <StreamPanels data={data} />
            <SentOnlyPanels data={data} links={links} />
            {/* The digest chain, the archive, the streams and the retention
                policy, from their own route (backend cecce62). The panel
                draws nothing at all where the API does not answer it, since
                an empty integrity panel would read as nothing protecting
                these events. */}
            <IntegrityPanel />
          </div>
          <Panel title="All security events" caption="By type and outcome">
            <CountList rows={eventRows(data.by_type)} empty="No security events in the period." />
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function SecurityTiles({ data, links }: { data: SecurityData; links: SecurityLinks }) {
  const tiles = securityTiles(data);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-testid="security-tiles">
      <ScoreTile label="Sign-in failures" value={tiles.signin} />
      <ScoreTile label="Denials" value={tiles.denials} />
      <ScoreTile label="Isolation probes" value={tiles.probes} />
      <ScoreTile label="Admin changes" value={tiles.admin} />
      <ScoreTile label="Exports and downloads" value={tiles.exports} />
      <ScoreTile label="Abuse events" value={tiles.abuse} />
      {data.rate_limited_clients ? (
        <ScoreTile label="Rate limited clients" value={tiles.rateLimited} href={links.apiClients} />
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
          href={links.connectors}
        />
      ) : null}
    </div>
  );
}

/** The five lists every API answers, counted out of the security stream over the window. */
function StreamPanels({ data }: { data: SecurityData }) {
  return (
    <>
      <Panel title="Sign-in failures" caption="By user and IP hash">
        <CountList
          rows={data.signin_failures.map((row) => ({
            key: [row.actor_id, row.ip_hash].join(":"),
            label: row.actor_id,
            detail: row.ip_hash ?? undefined,
            n: row.n,
          }))}
          empty="No failed sign-ins in the period."
        />
      </Panel>
      <Panel title="Isolation probes" caption="By actor, the top signal for a curious account">
        <CountList
          rows={data.isolation_probes.map((row) => ({ key: row.actor_id, label: row.actor_id, n: row.n }))}
          empty="No isolation-filtered requests in the period."
        />
      </Panel>
      <Panel title="Denials" caption="Permission, realm and account denials">
        <CountList
          rows={data.by_type.filter(isDenial).map((row) => ({ key: row.event_type, label: row.event_type, n: row.n }))}
          empty="No denials in the period."
        />
      </Panel>
      <Panel title="Admin changes" caption="Timeline by event type">
        <CountList
          rows={eventRows(data.by_type.filter(isAdminChange))}
          empty="No administrative changes in the period."
        />
      </Panel>
      <Panel title="Exports and downloads" caption="By event type">
        <CountList rows={eventRows(data.by_type.filter(isDataEvent))} empty="No exports or downloads in the period." />
      </Panel>
    </>
  );
}

/** The blocks a newer API added, each drawn only where the API sent it. */
function SentOnlyPanels({ data, links }: { data: SecurityData; links: SecurityLinks }) {
  return (
    <>
      {data.abuse_by_kind ? (
        <Panel title="Abuse" caption="Rate limits, signatures, loops, uploads, CSP">
          <CountList
            rows={data.abuse_by_kind.map((row) => ({ key: row.event_type, label: row.event_type, n: row.n }))}
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
          <CountList
            rows={data.rate_limited_clients.map((row) => ({
              key: [row.actor_id, row.principal_kind].join(":"),
              label: row.actor_id,
              detail: row.principal_kind ?? undefined,
              n: row.n,
              href: links.apiClients,
            }))}
            empty="The limiter turned nobody away in the period."
          />
        </Panel>
      ) : null}
      {data.paused_integrations ? (
        <Panel
          title="Paused integrations"
          caption="Paused subscriptions and tripped instances"
          subtitle="What is paused right now, one row per record, not what paused during the window. A tripped instance opens its own page and a paused subscription the account it belongs to."
        >
          <CountList
            rows={data.paused_integrations.map((row) => ({
              // The shape an older API answered carries no id; its rows are told apart by kind and reason.
              key: [row.kind, row.id, row.reason].join(":"),
              label: pausedLabel(row),
              detail: pausedDetail(row),
              // One row is one paused thing, so there is nothing to count here.
              href: pausedHref(row, links),
            }))}
            empty="Nothing is paused."
          />
        </Panel>
      ) : null}
      {data.quarantined_attachments ? (
        <Panel title="Quarantined files" caption="By where the file came from">
          <CountList
            rows={data.quarantined_attachments.map((row) => ({ key: row.origin, label: row.origin, n: row.n }))}
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
          <CountList
            rows={data.open_dead_letters.map((row) => ({
              key: [row.queue, row.account_id, row.instance_id].join(":"),
              label: row.queue,
              detail: deadLetterDetail(row),
              n: row.n,
              href: deadLetterHref(row, links),
            }))}
            empty="No open dead letters."
          />
        </Panel>
      ) : null}
    </>
  );
}
