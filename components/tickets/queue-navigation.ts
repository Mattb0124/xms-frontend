import { describeCondition, serializeConditions, type Condition, type ConditionField } from "@/lib/conditions";
import { CONDITIONS_PARAM } from "@/lib/tickets/queue-conditions";
import {
  chipsToSearch,
  MY_GROUPS,
  OUT_OF_SCOPE,
  outOfScopeLabel,
  QUEUE_VIEWS,
  type Chip,
  type ChipKey,
  type TicketListParams,
} from "@/lib/tickets/queue-views";
import { PRIORITIES, TICKET_TYPES } from "@/lib/tickets/vocab";
import { groupLabel } from "@/components/tickets/group-picker";
import type { DirectoryGroup, GrantedAccount } from "@/redux/ticketsApi";

/** The states the queue offers for a bulk move and for the state chip. */
export const QUEUE_STATE_OPTIONS = [
  "new",
  "assigned",
  "in_progress",
  "awaiting_client",
  "awaiting_third_party",
  "resolved",
  "closed",
  "cancelled",
] as const;

/**
 * The dimensions the tool strip always draws, whether or not they carry a
 * criterion. Everything else the grammar can say is a condition in the
 * builder the funnel opens.
 */
export const STANDING_CHIPS: ChipKey[] = ["account_id", "state", "priority", "type"];

/** What a navigation writes into the URL. An omitted field keeps the current one. */
export interface QueueNavigate {
  view?: string;
  chips?: Chip[];
  q?: string;
  limit?: number;
  conditions?: Condition[];
  sort?: TicketListParams["sort"];
}

export interface QueueLocation {
  view: string;
  chips: Chip[];
  q: string;
  limit: number;
  saved: string | null;
  sort: TicketListParams["sort"];
}

/** The chips with one dimension taken out, so a pill replaces rather than stacks. */
export function withoutChip(chips: Chip[], key: ChipKey): Chip[] {
  return chips.filter((chip) => chip.key !== key);
}

/**
 * The next URL for a criterion change. Changing a criterion drops the saved
 * view id: the list is no longer the saved one. The page size leaves it
 * alone, since it does not change what is being listed.
 */
export function queueSearchTarget(
  location: QueueLocation,
  conditions: Condition[],
  next: QueueNavigate,
): URLSearchParams {
  const target = chipsToSearch(
    next.view ?? location.view,
    next.chips ?? location.chips,
    next.q ?? location.q,
    next.limit ?? location.limit,
    next.sort ?? location.sort,
  );
  const nextConditions = next.conditions ?? conditions;
  if (nextConditions.length > 0) target.set(CONDITIONS_PARAM, serializeConditions(nextConditions));
  const criteriaKept =
    next.view === undefined && next.chips === undefined && next.q === undefined && next.conditions === undefined;
  if (criteriaKept && location.saved) target.set("saved", location.saved);
  return target;
}

export function chipValueLabel(
  chip: Chip,
  accountsById: ReadonlyMap<string, { name: string }>,
  groups: DirectoryGroup[] | undefined,
): string {
  if (chip.key === "account_id") return accountsById.get(chip.value)?.name ?? chip.value;
  if (chip.key === "type") return TICKET_TYPES.find((type) => type.value === chip.value)?.label ?? chip.value;
  if (chip.key === "priority") return chip.value.toUpperCase();
  if (chip.key === "out_of_scope") return outOfScopeLabel(chip.value);
  if (chip.key === "group_id") return groupLabel(groups, chip.value);
  if (chip.key === "my_groups") return "My groups";
  return chip.value.replace(/_/g, " ");
}

export function chipOptions(
  key: ChipKey,
  accounts: GrantedAccount[] | undefined,
  groups: DirectoryGroup[] | undefined,
): { value: string; label: string }[] {
  switch (key) {
    case "account_id":
      return (accounts ?? []).map((account) => ({ value: account.id, label: account.name }));
    case "type":
      return TICKET_TYPES.map((type) => ({ value: type.value, label: type.label }));
    case "priority":
      return PRIORITIES.map((priority) => ({ value: priority, label: priority.toUpperCase() }));
    case "state":
      return QUEUE_STATE_OPTIONS.map((state) => ({ value: state, label: state.replace(/_/g, " ") }));
    case "out_of_scope":
      return OUT_OF_SCOPE.map((value) => ({ value, label: outOfScopeLabel(value) }));
    case "group_id":
      return (groups ?? []).map((group) => ({ value: group.id, label: group.name }));
    // The group queue is a flag the server answers from the membership
    // table, so the only value on offer is the flag itself.
    case "my_groups":
      return [{ value: MY_GROUPS, label: "My groups" }];
  }
}

/** The condition trail: the view, each chip, each built condition, then the search. */
export function queueTrail(
  location: QueueLocation,
  viewLabel: string,
  conditions: Condition[],
  conditionFields: ConditionField[],
  accountsById: ReadonlyMap<string, { name: string }>,
  groups: DirectoryGroup[] | undefined,
): { key: string; label: string }[] {
  return [
    { key: "view", label: viewLabel },
    ...location.chips.map((chip) => ({
      key: `${chip.key}:${chip.value}`,
      label: chipValueLabel(chip, accountsById, groups),
    })),
    ...conditions.map((condition, index) => ({
      key: `condition:${index}`,
      label: describeCondition(condition, conditionFields),
    })),
    ...(location.q ? [{ key: "q", label: `Search: ${location.q}` }] : []),
  ];
}

/**
 * What removing one trail segment writes. The search box is cleared with the
 * search criterion, so the two cannot disagree.
 */
export function queueRemoval(
  key: string,
  location: QueueLocation,
  conditions: Condition[],
): { next: QueueNavigate; clearQuery: boolean } {
  if (key === "view") return { next: { view: QUEUE_VIEWS[0].key }, clearQuery: false };
  if (key === "q") return { next: { q: "" }, clearQuery: true };
  if (key.startsWith("condition:")) {
    const index = Number(key.slice("condition:".length));
    return { next: { conditions: conditions.filter((_, i) => i !== index) }, clearQuery: false };
  }
  return {
    next: { chips: location.chips.filter((chip) => `${chip.key}:${chip.value}` !== key) },
    clearQuery: false,
  };
}
