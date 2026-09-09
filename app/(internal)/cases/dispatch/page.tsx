"use client";

import { useMemo, useState } from "react";
import { AdminGate, fullName } from "@/components/admin/primitives";
import { HeaderFilters, HeaderSearch, HeaderSearchField } from "@/components/shell/content-header-bar";
import { accountHue } from "@/components/tickets/ticket-columns";
import { DispatchRow } from "@/components/xms/dispatch-card";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterSelect, StripSelect } from "@/components/xms/filter-select";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import { useListAssignableUsersQuery } from "@/redux/adminApi";
import { useMe } from "@/redux/me";
import {
  useListDirectoryGroupsQuery,
  useListGrantedAccountsQuery,
  useListTicketsQuery,
  usePatchTicketMutation,
} from "@/redux/ticketsApi";

/**
 * How long a request has waited, the way render 09 reads it: "26m", "3h",
 * "yesterday", then days. It is an age, not a countdown, so it carries no
 * "ago": the row it stands on says that already. An age stays an age however
 * old it gets, because a date would stop answering the question the column
 * asks, which is "how long has this been waiting".
 */
export function ageLabel(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  if (hours < 48) return "yesterday";
  const days = Math.floor(hours / 24);
  return days < 365 ? `${days}d` : `${Math.floor(days / 365)}y`;
}

/**
 * Dispatch (render 09, User Experience 3.5): every unrouted open request in
 * one card, oldest first, a row each.
 *
 * The rows are not grouped by account. The built screen put an account
 * heading and a count over a stack of separate cards, and the render carries
 * one card of hairline-separated rows with the account on the row itself,
 * which is what lets a dispatcher read fifteen requests without scrolling
 * past six headings.
 */
function DispatchScreen() {
  const me = useMe();
  const { push } = useToast();
  const track = useTrack("dispatch.assign");
  const [account, setAccount] = useState("");
  const [query, setQuery] = useState("");
  const { data, isLoading } = useListTicketsQuery(
    {
      unassigned: true,
      open: true,
      sort: "created_desc",
      limit: 100,
      ...(account ? { account_id: [account] } : {}),
      ...(query ? { q: query } : {}),
    },
    { pollingInterval: 60_000 },
  );
  const { data: accounts } = useListGrantedAccountsQuery();
  const { data: groups } = useListDirectoryGroupsQuery();
  const { data: users } = useListAssignableUsersQuery();
  const [patch] = usePatchTicketMutation();

  // Oldest first: the request that has waited longest is the one to route.
  const rows = useMemo(() => [...(data?.items ?? [])].reverse(), [data]);
  const accountsById = useMemo(() => new Map((accounts ?? []).map((row) => [row.id, row])), [accounts]);
  const groupOptions = useMemo(() => (groups ?? []).map((group) => ({ id: group.id, label: group.name })), [groups]);
  const assigneeOptions = useMemo(() => (users ?? []).map((user) => ({ id: user.id, label: fullName(user) })), [users]);

  const toolbar = (
    <>
      <HeaderFilters>
        <div className="flex items-center gap-2">
          {/* The count is the list the screen is showing, which is the same
              figure the sidebar's Dispatch badge reads. */}
          <StripSelect
            primary
            label="Show"
            value="unrouted"
            display={`unrouted (${data?.stats.unassigned ?? rows.length})`}
            onChange={() => undefined}
          >
            <option value="unrouted">Show: unrouted</option>
          </StripSelect>
          <FilterSelect
            label="Account"
            value={account}
            options={(accounts ?? []).map((row) => ({ value: row.id, label: row.name }))}
            onChange={setAccount}
          />
        </div>
      </HeaderFilters>
      <HeaderSearch>
        <HeaderSearchField value={query} onChange={setQuery} label="Search the unrouted" />
      </HeaderSearch>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Dispatch</h1>
      {toolbar}
      {isLoading && !data ? (
        <Skeleton lines={6} />
      ) : rows.length === 0 ? (
        <EmptyBanner title="Nothing waiting for triage." />
      ) : (
        <section className="xms-card overflow-hidden" aria-label="Unrouted requests">
          {rows.map((ticket) => {
            const owner = accountsById.get(ticket.account_id);
            return (
              <DispatchRow
                key={ticket.id}
                ticketKey={ticket.key}
                shortDescription={ticket.short_description}
                account={{ name: owner?.name ?? "Account", hue: accountHue(owner?.key) }}
                age={ageLabel(ticket.created_at)}
                groups={groupOptions}
                assignees={assigneeOptions}
                groupId={ticket.group_id ?? ""}
                currentUserId={me.principal?.userId ?? ""}
                onConfirm={({ groupId, assigneeId }) =>
                  patch({
                    key: ticket.key,
                    body: { version: ticket.version, group_id: groupId || null, assignee_id: assigneeId || null },
                  })
                    .unwrap()
                    .then(() => {
                      track({ ticket: ticket.key, assigned: Boolean(assigneeId) });
                      push({ title: `${ticket.key} routed`, tone: "success" });
                    })
                    .catch((error) =>
                      push({ title: "Not routed", detail: describeError(apiError(error)), tone: "error" }),
                    )
                }
              />
            );
          })}
        </section>
      )}
    </div>
  );
}

export default function DispatchPage() {
  return (
    <AdminGate permission="tickets:work">
      <DispatchScreen />
    </AdminGate>
  );
}
