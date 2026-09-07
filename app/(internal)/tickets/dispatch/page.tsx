"use client";

import { useMemo } from "react";
import { AdminGate, fullName } from "@/components/admin/primitives";
import { accountHue } from "@/components/tickets/ticket-columns";
import { DispatchCard } from "@/components/xms/dispatch-card";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import { clockSnapshot, tighterClock } from "@/lib/tickets/sla";
import { useListAssignableUsersQuery } from "@/redux/adminApi";
import { useMe } from "@/redux/me";
import {
  useListDirectoryGroupsQuery,
  useListGrantedAccountsQuery,
  useListTicketsQuery,
  usePatchTicketMutation,
  type TicketView,
} from "@/redux/ticketsApi";

/** Dispatch (User Experience 3.5): unassigned open tickets grouped by account, oldest first, one card each. */
function DispatchScreen() {
  const me = useMe();
  const { push } = useToast();
  const track = useTrack("dispatch.assign");
  const { data, isLoading } = useListTicketsQuery(
    { unassigned: true, open: true, sort: "created_desc", limit: 100 },
    { pollingInterval: 60_000 },
  );
  const { data: accounts } = useListGrantedAccountsQuery();
  const { data: groups } = useListDirectoryGroupsQuery();
  const { data: users } = useListAssignableUsersQuery();
  const [patch] = usePatchTicketMutation();

  const byAccount = useMemo(() => {
    const map = new Map<string, TicketView[]>();
    for (const ticket of [...(data?.items ?? [])].reverse()) {
      map.set(ticket.account_id, [...(map.get(ticket.account_id) ?? []), ticket]);
    }
    return map;
  }, [data]);
  const groupOptions = useMemo(
    () => [{ id: "", label: "No group" }, ...(groups ?? []).map((group) => ({ id: group.id, label: group.name }))],
    [groups],
  );
  const assigneeOptions = useMemo(() => (users ?? []).map((user) => ({ id: user.id, label: fullName(user) })), [users]);

  if (isLoading && !data) return <Skeleton lines={6} />;
  if (byAccount.size === 0) return <EmptyBanner title="Nothing waiting for triage." />;

  return (
    <div className="flex flex-col gap-6">
      {[...byAccount.entries()].map(([accountId, tickets]) => {
        const account = accounts?.find((row) => row.id === accountId);
        return (
          <section key={accountId} className="flex flex-col gap-3" aria-label={account?.name ?? accountId}>
            <h2 className="text-xms-ink flex items-center gap-2 text-[15px] font-semibold">
              {account?.name ?? "Account"}
              <span className="xms-mono bg-xms-tint text-xms-accent rounded-[999px] px-2 py-[2px] text-[11px]">
                {tickets.length}
              </span>
            </h2>
            {tickets.map((ticket) => (
              <DispatchCard
                key={ticket.id}
                ticketKey={ticket.key}
                shortDescription={ticket.short_description}
                account={{ name: account?.name ?? "Account", hue: accountHue(account?.key) }}
                type={ticket.type}
                priority={ticket.priority}
                sla={clockSnapshot(tighterClock(ticket.sla))}
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
            ))}
          </section>
        );
      })}
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
