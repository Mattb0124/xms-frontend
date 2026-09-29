"use client";

import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import { outcomeLine, useApplyBulkMutation, type BulkBody } from "@/redux/bulkApi";
import { useMe } from "@/redux/me";
import { useWatchTicketMutation, type TicketView } from "@/redux/ticketsApi";

/**
 * One call for the whole selection (TM-16). Each case carries the version
 * the reader read, and each comes back with its own outcome: a batch is not
 * a transaction, so the bar says how many moved and names what stopped the
 * rest, in the words of the refusal.
 */
export function useQueueBulk(
  rows: TicketView[],
  selected: Set<string>,
  setSelected: (next: Set<string>) => void,
): {
  assignSelected: () => Promise<void>;
  changeStateSelected: (to: string) => Promise<void>;
  setPrioritySelected: (priority: string) => Promise<void>;
  watchSelected: () => Promise<void>;
} {
  const { push } = useToast();
  const me = useMe();
  const [applyBulk] = useApplyBulkMutation();
  const [watch] = useWatchTicketMutation();
  const trackAssign = useTrack("dispatch.assign");

  const runBulk = async (body: BulkBody, verb: string) => {
    const targets = rows.filter((row) => selected.has(row.key));
    if (targets.length === 0) return;
    try {
      const result = await applyBulk({
        ...body,
        tickets: targets.map((row) => ({ key: row.key, version: row.version })),
      }).unwrap();
      const refused = result.results.filter((outcome) => outcome.outcome !== "ok");
      push({
        title: `${result.succeeded} ${verb}`,
        detail:
          refused.length > 0
            ? refused
                .slice(0, 3)
                .map((outcome) => `${outcome.key}: ${outcomeLine(outcome)}`)
                .join("; ") + (refused.length > 3 ? `, and ${refused.length - 3} more` : "")
            : undefined,
        tone: refused.length > 0 ? "info" : "success",
      });
      setSelected(new Set());
    } catch (error) {
      push({ title: "Nothing was changed", detail: describeError(apiError(error)), tone: "error" });
    }
  };

  const assignSelected = async () => {
    const userId = me.principal?.userId;
    if (!userId) return;
    trackAssign({ count: selected.size, via: "bulk" });
    await runBulk({ action: "assign", assignee_id: userId, tickets: [] }, "assigned to you");
  };

  const changeStateSelected = async (to: string) =>
    runBulk({ action: "transition", to, tickets: [] }, `moved to ${to.replace(/_/g, " ")}`);

  const setPrioritySelected = async (priority: string) =>
    runBulk({ action: "set_priority", priority, tickets: [] }, `set to ${priority.toUpperCase()}`);

  const watchSelected = async () => {
    for (const key of selected) {
      await watch({ key, muted: false })
        .unwrap()
        .catch(() => undefined);
    }
    push({ title: `Watching ${selected.size}`, tone: "success" });
    setSelected(new Set());
  };

  return { assignSelected, changeStateSelected, setPrioritySelected, watchSelected };
}
