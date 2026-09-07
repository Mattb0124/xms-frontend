"use client";

import { useMemo, useState } from "react";
import { PeriodSwitcher } from "@/components/reporting/period-switcher";
import { HeaderFilters } from "@/components/shell/content-header-bar";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { ScoreTile } from "@/components/xms/score-tile";
import { Skeleton } from "@/components/xms/skeleton";
import { useSecurityDashboardQuery, type SecurityDashboard as SecurityData } from "@/redux/reportingApi";

interface Count {
  label: string;
  detail?: string;
  n: number;
}

/** A dense list of counts with the mono number on the right. */
export function CountList({ rows, empty }: { rows: Count[]; empty: string }) {
  if (rows.length === 0) return <p className="text-xms-label text-[13px]">{empty}</p>;
  return (
    <ul className="flex flex-col">
      {rows.map((row, index) => (
        <li
          key={`${row.label}-${index}`}
          className="border-xms-line flex items-center gap-3 border-b py-2 text-[13px] last:border-b-0"
        >
          <span className="xms-mono text-xms-ink truncate">{row.label}</span>
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

/**
 * Security dashboard (Audit & Analytics 7.1, P2.19.4): sign-in failures,
 * denials by route, isolation probes by actor, admin changes, exports and
 * downloads, and an integrity placeholder until the digest job lands.
 */
export function SecurityDashboard() {
  const [days, setDays] = useState(7);
  const { data, isLoading, isError, refetch } = useSecurityDashboardQuery({ days });

  const tiles = useMemo(() => {
    if (!data) return null;
    return {
      signin: sumWhere(data, (row) => row.event_type === "auth.signin.failed"),
      denials: sumWhere(data, (row) => row.event_type.startsWith("authz.") && row.outcome === "denied"),
      probes: data.isolation_probes.reduce((total, row) => total + row.n, 0),
      admin: sumWhere(data, (row) => row.event_type.startsWith("admin.")),
      exports: sumWhere(
        data,
        (row) => row.event_type.startsWith("data.export") || row.event_type.startsWith("data.download"),
      ),
      webhooks: sumWhere(data, (row) => row.event_type.startsWith("abuse.")),
    };
  }, [data]);

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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <ScoreTile label="Sign-in failures" value={tiles.signin} tone={tiles.signin > 0 ? "warn" : "good"} />
            <ScoreTile label="Denials" value={tiles.denials} tone={tiles.denials > 0 ? "warn" : "good"} />
            <ScoreTile label="Isolation probes" value={tiles.probes} tone={tiles.probes > 0 ? "breach" : "good"} />
            <ScoreTile label="Admin changes" value={tiles.admin} />
            <ScoreTile label="Exports and downloads" value={tiles.exports} />
            <ScoreTile
              label="Bad webhook signatures"
              value={tiles.webhooks}
              tone={tiles.webhooks > 0 ? "warn" : "good"}
            />
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
