"use client";

import { useState } from "react";
import { EffectivePill, OverrideEditor } from "@/components/admin/config/override-editor";
import { RoutingRulesPanel } from "@/components/admin/config/routing-rules";
import { Panel } from "@/components/xms/panel";
import { CATALOG_KINDS, defaultScope, type CatalogKind } from "@/lib/admin/config-catalog";
import { cn } from "@/lib/utils";
import { useGetAccountConfigQuery, type ConfigKind } from "@/redux/adminApi";
import { useMe } from "@/redux/me";

function KindRow({
  accountId,
  entry,
  scope,
  selected,
  onSelect,
}: {
  accountId: string;
  entry: CatalogKind;
  scope?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { data } = useGetAccountConfigQuery({ accountId, kind: entry.key, scope });
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        data-kind={entry.key}
        className={cn(
          "hover:bg-xms-tint flex w-full items-center gap-3 rounded-[4px] px-3 py-2 text-left text-[13px]",
          selected && "bg-xms-tint shadow-[inset_3px_0_0_var(--xms-accent)]",
        )}
      >
        <span className="text-xms-ink font-medium">{entry.label}</span>
        {entry.scopes ? <span className="text-xms-label text-[12px]">per ticket type</span> : null}
        <span className="ml-auto">{data ? <EffectivePill view={data} /> : null}</span>
      </button>
    </li>
  );
}

/** The catalogs and their override editor; mounted only with `admin:config`. */
function CatalogOverrides({ accountId }: { accountId: string }) {
  const [kind, setKind] = useState<ConfigKind>(CATALOG_KINDS[0].key);
  const [scopes, setScopes] = useState<Partial<Record<ConfigKind, string>>>({});
  const scope = scopes[kind] ?? defaultScope(kind);
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Panel title="Catalogs" caption="What resolves for this account" flush>
        <ul className="flex flex-col gap-1 p-2" aria-label="Catalogs">
          {CATALOG_KINDS.map((entry) => (
            <KindRow
              key={entry.key}
              accountId={accountId}
              entry={entry}
              scope={entry.key === kind ? scope : (scopes[entry.key] ?? defaultScope(entry.key))}
              selected={entry.key === kind}
              onSelect={() => setKind(entry.key)}
            />
          ))}
        </ul>
      </Panel>
      <OverrideEditor
        accountId={accountId}
        kind={kind}
        scope={scope}
        onScopeChange={(next) => setScopes((previous) => ({ ...previous, [kind]: next }))}
      />
    </div>
  );
}

/**
 * The account record's Configuration tab (Accounts & Administration
 * functional 5.3 "Overrides" and 5.8): the catalogs with what resolves for
 * this account (Default or Override, version), and the editor for the
 * chosen one, which need `admin:config`; the API decides either way.
 *
 * Beneath them, the routing defaults (TM-08). They are configuration too,
 * and they are written with `admin:config` like the catalogs, but the API
 * answers the read to `tickets:view`, so they are their own panel with its
 * own gate rather than being hidden behind the write key.
 */
export function AccountConfigTab({ accountId }: { accountId: string }) {
  const me = useMe();
  const permitted = me.hasPermission("admin:config");
  return (
    <div className="flex flex-col gap-4">
      {permitted ? (
        <CatalogOverrides accountId={accountId} />
      ) : (
        <Panel title="Configuration" caption="Needs the admin:config permission">
          <p className="text-xms-label text-[13px]">You can see this account but not its configuration overrides.</p>
        </Panel>
      )}
      <RoutingRulesPanel accountId={accountId} />
    </div>
  );
}
