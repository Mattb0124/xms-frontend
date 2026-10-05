import { describe, expect, it } from "vitest";
import { groupLabel } from "@/components/tickets/group-picker";
import {
  chipOptions,
  chipValueLabel,
  queueRemoval,
  queueSearchTarget,
  type QueueLocation,
} from "@/components/tickets/queue-navigation";
import { CONDITIONS_PARAM } from "@/lib/tickets/queue-conditions";
import type { DirectoryGroup, GrantedAccount } from "@/redux/ticketsApi";

const location: QueueLocation = {
  view: "open",
  chips: [{ key: "priority", value: "p1" }],
  q: "cube",
  limit: 25,
  saved: "view-1",
  sort: "updated_desc",
};

const accounts: GrantedAccount[] = [
  { id: "acc-1", key: "ACME", name: "Acme", status: "active", owner_id: null, owner_name: null },
];

const groups: DirectoryGroup[] = [{ id: "grp-1", name: "Hosting", status: "retired" }];

describe("queue navigation", () => {
  it("drops the saved view when a criterion changes and keeps it for a sort", () => {
    const changed = queueSearchTarget(location, [], { chips: [] });
    expect(changed.get("saved")).toBeNull();
    expect(changed.get("q")).toBe("cube");
    expect(changed.has("priority")).toBe(false);

    const sorted = queueSearchTarget(location, [], { sort: "priority" });
    expect(sorted.get("saved")).toBe("view-1");
    expect(sorted.get("sort")).toBe("priority");
  });

  it("writes builder conditions and leaves them out when the set is empty", () => {
    const withOne = queueSearchTarget(location, [], {
      conditions: [{ field: "category", op: "eq", value: "hosting" }],
    });
    expect(withOne.get(CONDITIONS_PARAM)).toBeTruthy();
    expect(withOne.get("saved")).toBeNull();

    const cleared = queueSearchTarget(location, [{ field: "category", op: "eq", value: "hosting" }], {
      conditions: [],
    });
    expect(cleared.get(CONDITIONS_PARAM)).toBeNull();
  });

  it("names a trail removal, and clearing search also clears the box", () => {
    expect(queueRemoval("view", location, [])).toEqual({ next: { view: "open" }, clearQuery: false });
    expect(queueRemoval("q", location, [])).toEqual({ next: { q: "" }, clearQuery: true });
    const conditions = [{ field: "category", op: "eq" as const, value: "hosting" }];
    expect(queueRemoval("condition:0", location, conditions).next.conditions).toEqual([]);
    expect(queueRemoval("priority:p1", location, []).next.chips).toEqual([]);
  });

  it("labels an account by name and a retired group the way the picker does", () => {
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    expect(chipValueLabel({ key: "account_id", value: "acc-1" }, accountsById, groups)).toBe("Acme");
    expect(chipValueLabel({ key: "group_id", value: "grp-1" }, accountsById, groups)).toBe(groupLabel(groups, "grp-1"));
    expect(chipOptions("state", accounts, groups).map((option) => option.value)).toContain("awaiting_client");
    expect(chipOptions("group_id", accounts, groups)).toEqual([{ value: "grp-1", label: "Hosting" }]);
  });
});
