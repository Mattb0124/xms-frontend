"use client";

import { useState } from "react";
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { GroupPicker } from "@/components/tickets/group-picker";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { toRoutingRuleInputs, validateRoutingRules, type RoutingRuleDraft } from "@/lib/tickets/groups";
import { ticketTypeLabel } from "@/lib/tickets/vocab";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  ROUTABLE_TYPES,
  useListRoutingRulesQuery,
  useReplaceRoutingRulesMutation,
  type RoutableType,
  type RoutingRule,
} from "@/redux/ticketsApi";

function toDraft(rule: RoutingRule): RoutingRuleDraft {
  return { ticketType: rule.ticket_type, category: rule.category ?? "", groupId: rule.group_id };
}

/**
 * The account's routing defaults (TM-08): which assignment group takes which
 * kind of work. A ticket created without a group is dispatched by the most
 * specific rule that matches, and what the desk asks for still wins, so this
 * is a starting point rather than a rule the desk cannot override.
 *
 * The API replaces the whole set with one PUT, so the editor holds a draft
 * of the whole set and saves it in one go: a rule cannot be half-saved, and
 * a refused set changed nothing.
 */
function RoutingRulesEditor({ accountId, canWrite }: { accountId: string; canWrite: boolean }) {
  const { data, isLoading } = useListRoutingRulesQuery(accountId);
  const [replace, saving] = useReplaceRoutingRulesMutation();
  const { push } = useToast();
  // Null means "what the server last answered"; anything else is unsaved.
  const [draft, setDraft] = useState<RoutingRuleDraft[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const rules = draft ?? (data ?? []).map(toDraft);
  const edit = (index: number, change: Partial<RoutingRuleDraft>) =>
    setDraft(rules.map((rule, order) => (order === index ? { ...rule, ...change } : rule)));

  const save = async () => {
    const found = validateRoutingRules(rules);
    setProblems(found);
    if (found.length > 0) return;
    try {
      await replace({ accountId, rules: toRoutingRuleInputs(rules) }).unwrap();
      setDraft(null);
      push({ title: `${rules.length} routing rule${rules.length === 1 ? "" : "s"} saved`, tone: "success" });
    } catch (error) {
      push({ title: "The rules were not saved", detail: describeError(apiError(error)), tone: "error" });
    }
  };

  if (isLoading && !data) return <Skeleton lines={4} />;

  return (
    <div className="flex flex-col gap-3">
      <table className="w-full border-collapse text-[13px]" aria-label="Routing defaults">
        <thead>
          <tr className="border-xms-line text-xms-ink border-b text-left text-[12px] font-semibold">
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Group</th>
            {canWrite ? <th className="px-3 py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {rules.map((rule, index) => (
            <tr key={`${rule.ticketType}:${rule.category}:${index}`} className="border-xms-line border-b" data-rule>
              <td className="px-3 py-1.5">
                <select
                  aria-label={`Type of rule ${index + 1}`}
                  value={rule.ticketType}
                  disabled={!canWrite}
                  onChange={(event) => edit(index, { ticketType: event.target.value as RoutableType })}
                  className={cn(INPUT, "w-[180px]")}
                >
                  {ROUTABLE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ticketTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-1.5">
                <input
                  aria-label={`Category of rule ${index + 1}`}
                  value={rule.category}
                  disabled={!canWrite}
                  placeholder="Every category"
                  onChange={(event) => edit(index, { category: event.target.value })}
                  className={cn(INPUT, "w-[200px]")}
                />
              </td>
              <td className="px-3 py-1.5">
                <GroupPicker
                  aria-label={`Group of rule ${index + 1}`}
                  value={rule.groupId}
                  allowNone={false}
                  disabled={!canWrite}
                  onChange={(next) => edit(index, { groupId: next ?? "" })}
                  className="w-[220px]"
                />
              </td>
              {canWrite ? (
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => setDraft(rules.filter((_, order) => order !== index))}
                    className="text-xms-accent text-[12px] hover:underline"
                  >
                    Remove
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
          {rules.length === 0 ? (
            <tr>
              <td colSpan={canWrite ? 4 : 3} className="text-xms-label px-3 py-4 text-center">
                No routing defaults. Every ticket created without a group stays without one.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="text-xms-label text-[12px]">
        A rule naming a category wins over the rule for the type as a whole, and a retired group routes nothing.
      </p>
      {problems.length > 0 ? (
        <ul className="text-[12px] text-[color:var(--state-overdue-text)]">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft([...rules, { ticketType: ROUTABLE_TYPES[0], category: "", groupId: "" }])}
            className={SECONDARY_BUTTON}
          >
            Add rule
          </button>
          <button type="button" onClick={() => void save()} disabled={saving.isLoading} className={PRIMARY_BUTTON}>
            Save rules
          </button>
          {draft !== null ? (
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setProblems([]);
              }}
              className={SECONDARY_BUTTON}
            >
              Discard changes
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-xms-label text-[12px]">Changing the defaults needs the admin:config permission.</p>
      )}
    </div>
  );
}

/**
 * The panel around it. The API answers the read to `tickets:view` and the
 * write to `admin:config`, so a reader without `tickets:view` is told rather
 * than asking and taking a 403 for a question already answered here.
 */
export function RoutingRulesPanel({ accountId }: { accountId: string }) {
  const me = useMe();
  const canRead = me.hasPermission("tickets:view");
  return (
    <Panel
      title="Routing defaults"
      caption="ASSIGNMENT GROUPS"
      subtitle="Which group takes which kind of work when a ticket is created without one."
    >
      {canRead ? (
        <RoutingRulesEditor accountId={accountId} canWrite={me.hasPermission("admin:config")} />
      ) : (
        <p className="text-xms-label text-[13px]">
          Reading the routing defaults needs the tickets:view permission, which this account binding does not carry.
        </p>
      )}
    </Panel>
  );
}
