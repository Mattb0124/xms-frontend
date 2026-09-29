import type { AccountConfigView, ConfigVersion } from "@/redux/adminApi";

/** Constructed account configuration fixtures, shared by every test that reads one. */

/** Constructed configuration fixtures shared by the account configuration tests. */
export const ACCOUNT_ID = "77777777-7777-4777-8777-777777777777";

export function aConfigVersion(overrides: Partial<ConfigVersion> = {}): ConfigVersion {
  return {
    id: "cfg-default-1",
    kind: "sla_policy",
    scope_key: "*",
    version: 1,
    body: { calendar: "24x7", targets: { incident: { p1: { response_minutes: 30, resolution_minutes: 240 } } } },
    status: "active",
    activated_at: "2026-09-01T09:00:00Z",
    activated_by: "seed",
    created_at: "2026-09-01T09:00:00Z",
    ...overrides,
  };
}

export function anOverride(overrides: Partial<ConfigVersion> = {}): ConfigVersion {
  return aConfigVersion({
    id: "cfg-override-1",
    account_id: ACCOUNT_ID,
    body: { calendar: "24x7", targets: { incident: { p1: { response_minutes: 15, resolution_minutes: 240 } } } },
    activated_by: "user-1",
    activated_at: "2026-09-07T09:00:00Z",
    created_at: "2026-09-07T09:00:00Z",
    ...overrides,
  });
}

/** The account view with the default in force (the effective body is the given default's). */
export function anAccountConfig(overrides: Partial<AccountConfigView> = {}): AccountConfigView {
  const row = overrides.default ?? aConfigVersion();
  return {
    effective: { source: "default", version: row.version, versionId: row.id, body: row.body },
    default: row,
    overrides: [],
    ...overrides,
  };
}

/** The account view with an active override (version 2) over a retired one. */
export function anOverriddenConfig(): AccountConfigView {
  const current = anOverride({ id: "cfg-override-2", version: 2 });
  const previous = anOverride({ status: "retired" });
  return {
    effective: { source: "override", version: current.version, versionId: current.id, body: current.body },
    default: aConfigVersion(),
    overrides: [current, previous],
  };
}

/** The account view when nothing is active for the kind: no default, no override, nothing effective. */
export function aNothingActiveConfig(): AccountConfigView {
  return { effective: null, default: null, overrides: [] };
}
